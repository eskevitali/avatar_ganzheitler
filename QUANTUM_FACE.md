> **Актуальная пауза и переход в Blender:** см. [FACE_CHECKPOINT.md](FACE_CHECKPOINT.md) и [REFERENCE_MASK_002.md](REFERENCE_MASK_002.md). Ниже исторические записи; промежуточный статичный/2.5D портрет удалён и заменён отдельным новым 3D-пакетом `reference-mask-002`.

# Квантовое лицо: принятая визуальная основа

21 октября 2026 пользователь принял улучшенную воздушность, мягкий контур и спокойные глаза текущей головы. Эта основа зафиксирована перед добавлением активности света внутри лица. Дальнейшее увеличение/возвращение жёстких зрачков не требуется. Утверждённый фон остаётся отдельным слоем, без изменения яркости и рисунка.

## Профиль и установка

Пакет: `assets/quantum-face/profile.json` + `quantum-face.glb` (около 3 МБ), информация о происхождении в `LICENSE.txt`. Установка из корня репозитория:

```sh
node scripts/install-profile.mjs assets/quantum-face
```

Обновите страницу и выберите «Квантовое лицо · художественный прототип». Учебная кукла остаётся в выборе. Установщик намеренно не перезаписывает существующий id; уже установленный локальный пакет обновлялся в рамках разработки с сохранением его настроек. Пакеты для дальнейших выпусков следует версионировать новым id согласно PROFILES.md.

Геометрия — только голова. Основа анатомии взята из официального CC0 base mesh MakeHuman, обрезана и адаптирована; нити, morphs и адаптер построены в этом проекте. Тело/шея/плечи/руки не имеют видимой геометрии. Полный служебный именованный rig нужен встроенному TalkingHead; сама голова управляется morph targets, а малые движения задаёт доверенный адаптер. Это не производная геометрия учебного brunette.glb. Статичный PNG лица не используется.

Источник и проверка лицензии: [MakeHuman LICENSE.md](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md), раздел C; полный CC0 в `assets/sources/makehuman/LICENSE.ASSETS.md`. Извлечённая голова и SHA-256 исходного файла находятся в `assets/sources/makehuman/head.json`. При пересборке `python3 scripts/build-quantum-face.py` не требует сети, Blender или сторонних Python-пакетов. `scripts/prepare-makehuman-head.py` используется только для повторного извлечения исходной CC0 головы из официального base.obj.

## Безопасное appearance v1

Манифест остаётся formatVersion 1, обычные профили без appearance работают по-прежнему. Дополнительное поле:

```json
"appearance": {
  "type": "filaments",
  "style": "woven",
  "color": "#009fe8",
  "opacity": 0.52,
  "brightness": 1.6,
  "speed": 0.7,
  "amplitude": 0.00035
}
```

Поддерживаются только type `filaments`, style `lines`/`woven`, цвет #RRGGBB, opacity 0.05–1, brightness 0.2–3, speed 0–2, amplitude 0–0.002 м. Код, shader source и внешние ресурсы из пакета не исполняются. Материал `FilamentSurface` получает доверенный процедурный рисунок на анатомической поверхности; `FilamentContours` — отдельные физические волокна глаз/губ/бровей/краёв. Непрозрачной общей оболочки нет. Тонкое размытие применяется только к RGBA-canvas головы, фон остаётся резким.

В пульте есть независимые «Непрозрачность нитей», «Свечение», «Движение нитей». Они меняют только персонажа. «Сохранить параметры профиля» записывает их как `settings.visuals` рядом с губами и мимикой конкретного id в profiles.json. Голос/Flash/ключ не включаются в пакет и не заменяются при выборе куклы.

## Общий кадр и управление

Обычный пульт: `http://192.168.1.107:3100/`. При выборе профиля он показывает голову на принятом зале в композиции 16:9. «Сформировать лицо»/«Растворить» работают без текста. Для управления залом используется отдельный уже принятый пульт фона.

Кнопка «Общий кадр · 1920×1080» открывает чистый вид, связанный именно с текущим пультом. Он принимает ограниченное визуальное состояние и позы губ через BroadcastChannel внутри того же браузера/профиля и origin. Это связь локального preview, без ключей, аудио, новых TTS-запросов, LLM или очередей. Идентификатор связи сохраняется в sessionStorage текущей вкладки пульта и переживает reload. Для нового пульта/новой вкладки открывайте общий вид его кнопкой. Звук воспроизводит пульт; связанный вид повторяет визуальную мимику, не дублируя звук.

Самостоятельный `/?scene=1&view=clean` показывает полный 1920×1080 кадр с установленной головой, без пульта и технических надписей. Он требует обычный вход. Между Chrome и отдельным OBS/CEF-процессом BroadcastChannel не работает: транспорт живого управления/звука в OBS здесь не вводится, поскольку он ещё не определён. Чистый вид — готовая визуальная композиция, не реализация внешнего транспорта трансляции.

Для экономии повторных генераций последнее аудио хранится в памяти и sessionStorage текущей вкладки до 30 минут. Кэш совпадает строго по фразе и настройкам голоса/модели, сбрасывается при смене голоса и выходе. Ошибка/переполнение storage не ломает речь. Повтор и reload той же фразы используют одно аудио, если кэш доступен.

## Проверки и дальнейшее состояние

`node test/quantum-face.test.mjs` проверяет самодостаточность пакета, ограничение видимой геометрии областью головы, настоящие деформации viseme/век/эмоций, отсутствие непрозрачного материала и сохранение visuals независимо от учебного профиля. `test/clip-cache.test.mjs` проверяет выбор правильного кэша и безопасный отказ storage. Общие проверки профилей, TTS-ошибок и фона остаются применимы.

На визуальном checkpoint подтверждены в видимом Chrome общая композиция, полное растворение/формирование без текста и раскрытие рта «А». Первое измерение общего пульта было около 25 fps; затем число проходов и размер буфера головы уменьшены. Итоговые замеры, проверка речи и новое сияние должны быть дописаны после фактической проверки, а не объявлены пройденными заранее.


## Сияние активности: checkpoint перед паузой

Принятая внешность зафиксирована в a375bb4. Геометрия GLB и PNG фона при добавлении активности не менялись (проверены хэши). В профиль добавлено ограниченное поле `appearance.activity: {"type":"neural-glow","strength":0.65}`; пользовательское значение `visuals.activityStrength` — 0–1. Шейдер усиливает только существующие лобные нити в трёх мягких движущихся локальных областях, без увеличения alpha покрытия. Глаза и губы не заслоняются. В покое огибающая 0.08 и медленное дыхание, во время реального isSpeaking/isAudioPlaying — сглаженная реакция на RMS существующего аудиоанализатора. После фразы предусмотрен короткий видимый покой/спад, затем ранее установленное растворение. Это художественная метафора активности, не диагностика мышления и не LLM.

Проверено: тесты огибающей/границ проходят; в видимом пульте выполнен один реальный запрос Flash на 10 слов, сервер ответил speak.completed. Во время кэшированного повтора источник показывал activity=0.627, RMS=0.088, mode=speech; до/после — 0.080/idle. Счётчик API-запросов оставался 1. Первый тест связанного вида выявил старый channel-id после reload пульта; идентификатор теперь сохраняется в sessionStorage, но окончательная повторная визуальная проверка связанного сияния ещё обязательна.

Новое поручение пользователя: небольшие спокойные случайные yaw/pitch повороты головы во время разговора, нерегулярные целевые углы/интервалы, критически затухающее сглаживание, возврат в покой. ЭТО ЕЩЁ НЕ РЕАЛИЗОВАНО на текущем checkpoint. Следует убрать существующую периодическую shader-синусоиду и заменить одним драйвером после morph deformation; не накладывать конфликтующий поворот на служебные кости. Видимая голова — morph-driven, не SkinnedMesh; встроенные движения TalkingHead затрагивают скрытый rig. Принятую форму/глаза/контур/фон не менять. Нужны тесты случайных неповторяющихся траекторий и видимая речь/повтор из сохранённого аудио.

## Reference 002 replacement
The user rejected the former anatomical head as skull-like and explicitly requested
using Templ/002.png without changing its appearance. The active quantum-face display
now uses a byte-identical copy at public/portraits/002.png, via portrait.mjs. It preserves
native alpha, aspect ratio and color. No image generation or raster editing was used.
The old GLB remains available internally for the existing audio pipeline, but its
canvas is hidden. This is a static portrait, with scene appearance/disappearance;
its mouth and eyes do not animate. Morph/glow controls are hidden for this display.
The approved background and voice configuration are unchanged. Verified in visible
Chrome: original image loaded, centered on the existing hall. No paid TTS was used.
Earlier neural-glow work remains in the working tree but is bypassed for this portrait.

### Clarification: keep the face animated
The user clarified that a static portrait is insufficient: lips, eyes and movement
must continue to work. portrait.mjs now maps the unchanged PNG onto a dense animated
mesh. Existing TalkingHead morph values drive jaw/visemes, smile, brows, blink and
gaze. A mouth interior is drawn only while opening; smooth small random turns run
during speech and return to neutral. This is 2.5D portrait animation, not reconstructed
full 3D anatomy; profile views and large turns are intentionally unsupported.
Existing speech/alignment/cache and paired scene paths are retained. Mood/lip controls
are visible again; filament-specific recoloring/glow controls remain hidden.
Visible Chrome checks confirmed the animated canvas and an A-pose jaw response.
The prior static-portrait paragraph above describes the superseded interim state.
