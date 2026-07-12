import os
import sqlite3
from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.schema import CreateIndex, CreateTable

# SQLite dosyasi backend/ kokunde durur. Tek dosya = kolay yedek/tasima.
# Testler ayri bir DB kullanabilsin diye env ile gecersiz kilinabilir.
SQLALCHEMY_DATABASE_URL = os.getenv("LINGUA_DATABASE_URL", "sqlite:///./lingua.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    # SQLite + FastAPI'nin thread havuzu icin gerekli.
    connect_args={"check_same_thread": False},
)


@event.listens_for(Engine, "connect")
def _enable_sqlite_fk(dbapi_connection, connection_record):
    """SQLite FK kisitlarini denetlemez; ON DELETE CASCADE icin acmamiz gerek."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Tum ORM modellerinin ortak tabani."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: istek basina bir DB oturumu acar/kapatir."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Sistemi tohumladigimiz ~6 dil (ogrenme amacli). crud.language.CATALOG_SEED ile ayni;
# dongusel import olmasin diye burada da tutulur.
_CATALOG_SEED: list[tuple[str, str, str]] = [
    ("tr", "Turkish", "Türkçe"),
    ("en", "English", "English"),
    ("it", "Italian", "Italiano"),
    ("es", "Spanish", "Español"),
    ("de", "German", "Deutsch"),
    ("fr", "French", "Français"),
]


def _seed_catalog() -> None:
    """Katalogu seed'e gore tutarli tutar (idempotent).

    - Eksik standart dilleri ekler.
    - is_catalog'u seed uyelegine gore yeniden hesaplar: sadece standart 6 dil
      katalogta gorunur; kullanicinin ad-hoc/ozel kayitlari (orn. 'IELTS') gizlenir.
    """
    codes = [c for c, _, _ in _CATALOG_SEED]
    with engine.begin() as conn:
        for code, name, native in _CATALOG_SEED:
            exists = conn.execute(
                text("SELECT 1 FROM languages WHERE code = :c"), {"c": code}
            ).first()
            if not exists:
                conn.execute(
                    text(
                        "INSERT INTO languages (code, name, native_name, order_index, is_catalog) "
                        "VALUES (:c, :n, :nn, 0, 1)"
                    ),
                    {"c": code, "n": name, "nn": native},
                )
        placeholders = ",".join(f":c{i}" for i in range(len(codes)))
        params = {f"c{i}": c for i, c in enumerate(codes)}
        conn.execute(
            text(
                f"UPDATE languages SET is_catalog = CASE WHEN code IN ({placeholders}) "
                "THEN 1 ELSE 0 END"
            ),
            params,
        )


def ensure_schema() -> None:
    """Hafif otomatik gocum: var olan DB'de eksik kolonlari/verileri ekler (veri korunur).

    create_all yeni tablolari kurar ama mevcut tablolara kolon eklemez; SRS/Alembic
    gelene kadar bu kucuk yardimci tek tek eklemeleri ve tek seferlik veri gocunu ustlenir.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "languages" not in tables:
        return

    lang_cols = {c["name"] for c in inspector.get_columns("languages")}
    # native_language_id'nin yoklugu = kurs/anlam modeli oncesi eski sema -> tek seferlik gocum.
    legacy = "native_language_id" not in lang_cols

    if legacy:
        # Mevcut tum dil satirlari (kullanicinin ogrendigi hedef diller) = kurslar olacak.
        with engine.begin() as conn:
            legacy_course_ids = [r[0] for r in conn.execute(text("SELECT id FROM languages"))]

    with engine.begin() as conn:
        if "order_index" not in lang_cols:
            conn.execute(
                text("ALTER TABLE languages ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0")
            )
        if "is_catalog" not in lang_cols:
            conn.execute(
                text("ALTER TABLE languages ADD COLUMN is_catalog BOOLEAN NOT NULL DEFAULT 1")
            )
        if "native_language_id" not in lang_cols:
            conn.execute(
                text("ALTER TABLE languages ADD COLUMN native_language_id INTEGER REFERENCES languages(id)")
            )

    # Katalogu her acilista tohumla (idempotent).
    _seed_catalog()
    _ensure_ai_suggestion_cache_table()
    _ensure_learning_session_indexes()

    word_cols: set[str] = set()
    if "words" in tables:
        word_cols = {c["name"] for c in inspector.get_columns("words")}
        word_additions = {
            "learning_status": "ALTER TABLE words ADD COLUMN learning_status VARCHAR(20) NOT NULL DEFAULT 'new'",
            "review_stage": "ALTER TABLE words ADD COLUMN review_stage INTEGER NOT NULL DEFAULT 0",
            "next_review_date": "ALTER TABLE words ADD COLUMN next_review_date DATE",
            "learned_at": "ALTER TABLE words ADD COLUMN learned_at DATETIME",
            "phonetic_native": "ALTER TABLE words ADD COLUMN phonetic_native VARCHAR(200)",
            "pronunciation_note_native": "ALTER TABLE words ADD COLUMN pronunciation_note_native TEXT",
            "level": "ALTER TABLE words ADD COLUMN level VARCHAR(2)",
            "synonyms": "ALTER TABLE words ADD COLUMN synonyms TEXT",
            "antonyms": "ALTER TABLE words ADD COLUMN antonyms TEXT",
            "word_family": "ALTER TABLE words ADD COLUMN word_family TEXT",
            "accepted_answers": "ALTER TABLE words ADD COLUMN accepted_answers TEXT",
        }
        missing = [sql for col, sql in word_additions.items() if col not in word_cols]
        if missing:
            with engine.begin() as conn:
                for sql in missing:
                    conn.execute(text(sql))
            # phonetic_tr -> phonetic_native (eski kolondaki veriyi tasi).
            if "phonetic_native" not in word_cols and "phonetic_tr" in word_cols:
                with engine.begin() as conn:
                    conn.execute(text("UPDATE words SET phonetic_native = phonetic_tr"))

    if legacy:
        _migrate_legacy_courses(legacy_course_ids, word_cols)

    # 'Kurs = dil satiri' modelinden ayri Course tablosuna tek seferlik gocum.
    needs_course_migration = "words" in tables and "course_id" not in word_cols
    if needs_course_migration:
        _migrate_to_course_table()

    # Ayri, her zaman calisan, idempotent adim: course_id backfill'i daha once
    # (eksik bir surumde) yapilmis ama eski NOT NULL 'language_id' kolonu fiziksel
    # olarak kalmis olabilir -- bu durumda yeni INSERT'ler NOT NULL ihlaliyle patlar.
    # Bagimsiz calismasi, gecmiste yarim kalmis bir gocumu de kendiliginden onarir.
    _drop_legacy_language_id_columns()


def _ensure_ai_suggestion_cache_table() -> None:
    """AI form-doldurma onerileri icin lokal cache tablosu.

    Bu tablo kullanici verisinin parcasi degil; Gemini/HF gibi kaynaklara ayni kelime
    ve anlam icin tekrar gitmemek amaciyla tutulur. Idempotent oldugu icin mevcut DB'ye
    zarar vermeden her acilista calisir.
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS ai_suggestion_cache (
                    id INTEGER PRIMARY KEY,
                    cache_key TEXT NOT NULL UNIQUE,
                    kind TEXT NOT NULL,
                    term TEXT NOT NULL,
                    target_language_code TEXT NOT NULL,
                    native_language_code TEXT NOT NULL,
                    helper_language_codes TEXT,
                    sense_hint TEXT,
                    provider TEXT,
                    model TEXT,
                    payload_json TEXT NOT NULL,
                    prompt_version TEXT NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    last_used_at DATETIME,
                    hit_count INTEGER NOT NULL DEFAULT 0
                )
                """
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_ai_suggestion_cache_kind_term "
                "ON ai_suggestion_cache (kind, term)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_ai_suggestion_cache_created_at "
                "ON ai_suggestion_cache (created_at)"
            )
        )


def _ensure_learning_session_indexes() -> None:
    """Kalici ogrenme oturumunun SQLite'a ozel kismi: kurs basina tek aktif session."""
    if "learning_sessions" not in inspect(engine).get_table_names():
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_sessions_active_course "
                "ON learning_sessions(course_id) WHERE status = 'active'"
            )
        )


def _migrate_to_course_table() -> None:
    """'Kurs = dil satiri' modelinden ayri Course tablosuna gocer.

    Her Language satiri (native_language_id NOT NULL = eski 'kurs') icin yeni bir
    Course satiri olusturur, yardimci dillerini tasir, ve words/topics/labels/
    review_events uzerindeki eski 'language_id' kolonunu yeni 'course_id'ye esler.
    Eski 'language_id' kolonu NOT NULL oldugu icin (ve ORM artik onu hic doldurmadigi
    icin) yerinde birakilamaz -- yeni INSERT'ler bu kisiti ihlal eder. Bu yuzden
    backfill sonrasi DROP COLUMN ile gercekten kaldirilir (SQLite 3.35+ destekler).
    """
    inspector = inspect(engine)
    target_tables = ["words", "topics", "labels", "review_events"]
    existing = set(inspector.get_table_names())
    cols_before = {
        tbl: {c["name"] for c in inspector.get_columns(tbl)}
        for tbl in target_tables
        if tbl in existing
    }

    with engine.begin() as conn:
        for tbl, cols in cols_before.items():
            if "course_id" not in cols:
                conn.execute(
                    text(
                        f"ALTER TABLE {tbl} ADD COLUMN course_id INTEGER "
                        "REFERENCES courses(id) ON DELETE CASCADE"
                    )
                )

        old_courses = conn.execute(
            text(
                "SELECT id, native_language_id, order_index FROM languages "
                "WHERE native_language_id IS NOT NULL"
            )
        ).mappings().all()

        old_to_new: dict[int, int] = {}
        for row in old_courses:
            result = conn.execute(
                text(
                    "INSERT INTO courses (target_language_id, native_language_id, order_index) "
                    "VALUES (:t, :n, :o)"
                ),
                {"t": row["id"], "n": row["native_language_id"], "o": row["order_index"]},
            )
            new_id = result.lastrowid
            old_to_new[row["id"]] = new_id

            for helper_id, position in conn.execute(
                text(
                    "SELECT helper_language_id, position FROM language_helpers "
                    "WHERE course_language_id = :c"
                ),
                {"c": row["id"]},
            ).all():
                conn.execute(
                    text(
                        "INSERT OR IGNORE INTO course_helpers (course_id, language_id, position) "
                        "VALUES (:c, :h, :p)"
                    ),
                    {"c": new_id, "h": helper_id, "p": position},
                )

        for tbl, cols in cols_before.items():
            if "language_id" not in cols:
                continue
            for old_id, new_id in old_to_new.items():
                conn.execute(
                    text(
                        f"UPDATE {tbl} SET course_id = :new "
                        "WHERE language_id = :old AND course_id IS NULL"
                    ),
                    {"new": new_id, "old": old_id},
                )
    # NOT NULL kisitli eski kolonu kaldir (ayri, her zaman calisan, idempotent adim --
    # bkz. _drop_legacy_language_id_columns).


def _drop_legacy_language_id_columns() -> None:
    """Eski 'kurs = dil satiri' modelinden kalan NOT NULL 'language_id' kolonlarini
    kaldirir. course_id backfill'inin yapilip yapilmadigindan bagimsiz, sadece
    kolonun fiziksel varligina bakar -- bu yuzden yarim kalmis bir gocumu da
    kendiliginden tamamlar (idempotent: kolon yoksa hicbir sey yapmaz).

    SQLite, bir FOREIGN KEY kisitina dahil kolonu duz ALTER TABLE DROP COLUMN ile
    silmeye izin vermez ('language_id' eski FK'siydi). Bu yuzden tabloyu mevcut ORM
    modeline (artik language_id icermiyor) gore yeniden olusturup veriyi tasiriz.
    """
    inspector = inspect(engine)
    target_tables = ["words", "topics", "labels", "review_events"]
    existing = set(inspector.get_table_names())
    for tbl in target_tables:
        if tbl not in existing:
            continue
        cols = {c["name"] for c in inspector.get_columns(tbl)}
        if "language_id" in cols:
            _rebuild_table_without_legacy_column(tbl)


def _rebuild_table_without_legacy_column(table_name: str) -> None:
    """Base.metadata'daki guncel tablo tanimina gore tabloyu yeniden olusturur
    (gecici adla), ortak kolonlardaki veriyi tasir, eskisini silip yeni adini
    eskisiyle degistirir. Indexler de ayrica yeniden olusturulur.

    SQLite'ta PRAGMA foreign_keys, acik bir islem (transaction) icindeyken
    degistirilemez (sessizce yok sayilir). engine.begin() ile kapanmis bir
    SQLAlchemy baglantisi kullanirsak FK denetimi kapanmadan tablo silinip
    yeniden kurulur -- bu da ON DELETE CASCADE'li iliskili satirlarin (orn.
    review_events, word_meanings) yanlislikla silinmesi riskini tasir. Bu yuzden
    burada islemi tamamen SQLAlchemy pool'unun disinda, ham bir sqlite3
    baglantisiyla ve PRAGMA'yi gercekten islem disinda kapatarak yapiyoruz.
    """
    db_path = engine.url.database
    if not db_path:
        return  # in-memory DB (testler ensure_schema'yi hic cagirmaz, ama yine de guvenlik)

    target = Base.metadata.tables[table_name]
    tmp_name = f"{table_name}__rebuild"
    # Bos bir MetaData'ya kopyalarsak FK'lerin hedefledigi diger tablolar (orn.
    # 'courses') bulunamaz; bu yuzden ayni Base.metadata'ya gecici adla ekleyip
    # isimiz bitince kaldiriyoruz.
    tmp_table = target.to_metadata(Base.metadata, name=tmp_name)
    keep_columns = ", ".join(c.name for c in target.columns)
    create_sql = str(CreateTable(tmp_table).compile(dialect=engine.dialect))
    index_sqls = [str(CreateIndex(idx).compile(dialect=engine.dialect)) for idx in tmp_table.indexes]

    raw = sqlite3.connect(db_path)
    raw.isolation_level = None  # autocommit; BEGIN/COMMIT'i elle yonetelim
    try:
        raw.execute("PRAGMA foreign_keys=OFF")  # islem disinda -- gercekten etkili olur
        raw.execute("BEGIN")
        raw.execute(f"DROP TABLE IF EXISTS {tmp_name}")
        raw.execute(create_sql)
        raw.execute(
            f"INSERT INTO {tmp_name} ({keep_columns}) SELECT {keep_columns} FROM {table_name}"
        )
        # Indexleri RENAME'den once, hala gecici adliyken olustur (sql'ler o ada gore
        # derlendi); aksi halde 'CREATE INDEX ... ON {tmp_name}' artik var olmayan
        # bir tabloyu hedefler.
        for sql in index_sqls:
            raw.execute(sql)
        raw.execute(f"DROP TABLE {table_name}")
        raw.execute(f"ALTER TABLE {tmp_name} RENAME TO {table_name}")
        raw.execute("COMMIT")
    except Exception:
        raw.execute("ROLLBACK")
        raise
    finally:
        raw.execute("PRAGMA foreign_keys=ON")
        raw.close()
        Base.metadata.remove(tmp_table)  # gecici tablo tanimini metadata'dan temizle


def _migrate_legacy_courses(course_ids: list[int], word_cols: set[str]) -> None:
    """Eski semadaki verileri yeni modele tasir: kurslara ana dil=TR/yardimci=EN ata,
    eski meaning_native/meaning_english kolonlarini word_meanings tablosuna gocur."""
    with engine.begin() as conn:
        tr_id = conn.execute(text("SELECT id FROM languages WHERE code = 'tr'")).scalar()
        en_id = conn.execute(text("SELECT id FROM languages WHERE code = 'en'")).scalar()
        if tr_id is None:
            return

        for cid in course_ids:
            if cid == tr_id:  # ana dilin kendisi kurs degil
                continue
            conn.execute(
                text(
                    "UPDATE languages SET native_language_id = :tr "
                    "WHERE id = :id AND native_language_id IS NULL"
                ),
                {"tr": tr_id, "id": cid},
            )
            if en_id is not None and en_id != cid:
                conn.execute(
                    text(
                        "INSERT OR IGNORE INTO language_helpers "
                        "(course_language_id, helper_language_id, position) VALUES (:c, :h, 0)"
                    ),
                    {"c": cid, "h": en_id},
                )

        # Kelime anlamlarini gocur (eski kolonlar hala fiziksel olarak duruyorsa).
        has_native = "meaning_native" in word_cols
        has_english = "meaning_english" in word_cols
        if has_native or has_english:
            select_cols = "id" + (", meaning_native" if has_native else "") + (
                ", meaning_english" if has_english else ""
            )
            for row in conn.execute(text(f"SELECT {select_cols} FROM words")).mappings():
                wid = row["id"]
                if has_native and (row["meaning_native"] or "").strip():
                    conn.execute(
                        text(
                            "INSERT OR IGNORE INTO word_meanings (word_id, language_id, value) "
                            "VALUES (:w, :l, :v)"
                        ),
                        {"w": wid, "l": tr_id, "v": row["meaning_native"]},
                    )
                if has_english and en_id is not None and (row["meaning_english"] or "").strip():
                    conn.execute(
                        text(
                            "INSERT OR IGNORE INTO word_meanings (word_id, language_id, value) "
                            "VALUES (:w, :l, :v)"
                        ),
                        {"w": wid, "l": en_id, "v": row["meaning_english"]},
                    )
