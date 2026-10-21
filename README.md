# Avatar

Пробная страница: текст превращается в голос ElevenLabs, маска открывает рот по громкости.

Код: этот репозиторий. Секреты сюда не класть, репозиторий публичный.

На `ganz-app-node` ключи и пароль входа живут в одном файле:

```text
/opt/avatarnode/secrets/app.env
```

После правки файла контейнер перечитывает его так:

```bash
docker restart avatarnode-web
```

Контейнер `avatarnode-web` сидит в сети `web_network` и слушает порт `3000`. Наружу порт не опубликован. В Nginx Proxy Manager сайт `avatar.ganzheitler.cloud` смотрит на `http://avatarnode-web:3000`.

Профили кукол, установка пакетов, совместимость, сохранение и локальная проверка: [PROFILES.md](PROFILES.md).
