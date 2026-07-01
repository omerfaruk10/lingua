from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LanguageBrief(BaseModel):
    """Dropdown / iliskili dil gosterimi icin sade dil bilgisi."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    native_name: str


class LangRef(BaseModel):
    """Bir dile referans: ya mevcut katalog dili (id) ya da 'o anlik' yeni dil.

    id verilirse o katalog dili kullanilir. id yoksa code/name/native_name ile
    ad-hoc bir dil olusturulur (is_catalog=False; dropdown'da gorunmez).
    """

    id: int | None = None
    code: str | None = None
    name: str | None = None
    native_name: str | None = None


class CourseCreate(BaseModel):
    """Yeni kurs (ogrenme kurulumu): hedef + ana dil + opsiyonel yardimci diller.

    Ayni hedef dil icin birden fazla kurs olusturulabilir (orn. farkli ana
    dillerle) -- burada tekillik kisitlamasi yoktur.
    """

    target: LangRef
    native: LangRef
    helpers: list[LangRef] = Field(default_factory=list)


class CourseUpdate(BaseModel):
    # Gonderilen alanlar guncellenir; gerisi dokunulmaz. Hedef dil degistirilemez
    # (degistirmek istenirse yeni bir kurs olusturulur).
    order_index: int | None = None
    native: LangRef | None = None
    helpers: list[LangRef] | None = None


class CourseRead(BaseModel):
    """Bir kurs: hedef dil + ana dil + yardimci diller."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    native_name: str
    order_index: int
    created_at: datetime
    target_language: LanguageBrief
    native_language: LanguageBrief
    helper_languages: list[LanguageBrief] = []
