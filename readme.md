# Телеграмм бот для отправки уведомлений из ноушен
Данный бот при команде /notifi получает список всех страниц базы данных и отправляет 10 страниц редактированных наиболее недавно, а также добавляет айди чата с пользователем отправившим команду в файл users.json. После чего каждые 5 минут получает новые страницы и сравнивает с массивом старых. Отличающиейся отправляет всем пользователем из файла users.json.

По команде /stop_notifi бот удаляет айди чата пользователя из файла users.json и ему больше не приходят уведомления.

## Запуск
Для того, чтобы запустить бота создайте файл .env в нем должно быть 3 переменные:
```
TELEGRAM_BOT_TOKEN // Получаем создавая бота в телеге
NOTION_API_KEY // Получаем создав интеграцию в ноушен
NOTION_DATABASE_ID // Получаем из ссылки в адресной строке браузера, если страница ношена открыта в режиме full page
```

После этого прописываем команду, чтобы скачать все необходимые модули
```
npm i
```

И запускаем бота
```
npm start
```