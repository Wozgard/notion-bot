const TelegramBot = require('node-telegram-bot-api');
const { Client } = require('@notionhq/client');
const { config } = require('dotenv');
const fs = require('fs');

let lastNotificationTime;
const dateOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
};
const timeOptions = {
    hour: 'numeric',
    minute: 'numeric'
}
const fileName = 'users.json';

// Получаем айди чатов всех пользователей, подписанных на уведомления
let chatsId = []
fs.readFile(fileName, 'utf8', function (err, data) {
    if (err) throw err;
    chatsId = JSON.parse(data);
    console.log(chatsId);
});
// Загружаем переменные окружения из файла .env
config();

// Создаем нового Telegram-бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    // Отправляем приветственное сообщение
    bot.sendMessage(msg.chat.id, 'Привет! Чтобы получать уведомления из Notion, введи /notifi');
});

// Обработчик команды /notifi, которая отправляет 10 последних уведомлений 
// и подписывает человека на рассылку новых уведомлений
bot.onText(/\/notifi/, (msg) => {
    // Проверяем есть ли уже у нас такой чат айди, если нет - добавляем и записываем в файл
    if (!chatsId.includes(msg.chat.id)) {
        chatsId.push(msg.chat.id);

        let jsonChats = JSON.stringify(chatsId);
        fs.writeFile(fileName, jsonChats, function (err) {
            if (err) throw err;
            console.log('Data saved to file');
        });
    }

    // Получаем массив страниц из базы данных ноушен
    let currentResults;
    getNotionNotifications(process.env.NOTION_API_KEY, process.env.NOTION_DATABASE_ID).then(res => {
        currentResults = res;
        // Соритруем по времени редактирования
        currentResults.sort((a, b) => a.last_edited_time > b.last_edited_time ? 1 : -1).reverse();

        // Отправляем последние 10 измененных страниц
        sendNotificationsLoop(currentResults, 9, false, msg.chat.id)

    });

    // Каждые 5 минут получаем новый массив страниц
    setInterval(() => {
        let newResults;
        getNotionNotifications(process.env.NOTION_API_KEY, process.env.NOTION_DATABASE_ID).then(res => {
            newResults = res;
            // Также сортируем его
            newResults.sort((a, b) => a.last_edited_time > b.last_edited_time ? 1 : -1).reverse();

            // Проверяем есть ли изменения относительно предыдущего массива страниц
            let updates = change(currentResults, newResults);
            console.log(updates)
            if (updates.length > 0) {
                console.log('===========UPDATES===========')
                // Отправляем все измененные страницы
                sendNotificationsLoop(updates, updates.length - 1)
                currentResults = newResults;
            }
        });
    }, 5 * 60 * 1000);
});

// Отписываем пользователя от обновлений. Для этого удаляем его из списка
bot.onText(/\/stop_notofi/, (msg) => {
    const index = chatsId.indexOf(msg.chat.id);

    if (index !== -1) {
        chatsId.splice(index, 1);
    }
    let jsonChats = JSON.stringify(chatsId);
    fs.writeFile(fileName, jsonChats, function (err) {
        if (err) throw err;
        console.log('Data saved to file');
    });
    bot.sendMessage(msg.chat.id, 'Вы успешно отписались от уведомлений');
});

console.log('Telegram-бот запущен');

// Асинхронная функция для поочередной отправки сообщений в бота
async function sendNotificationsLoop(currentResults, quantyty, changed = true, chatIdNow = 0) {
    for (let i = quantyty; i >= 0; i--) {
        let time = new Date(currentResults[i].last_edited_time);
        console.log('\n', time);

        if (chatIdNow !== 0) {
            await sendNotifications(chatIdNow, currentResults[i]);
        }
        else {
            for (let chat = 0; chat < chatsId.length; chat++) {
                await sendNotifications(chatsId[chat], currentResults[i], changed);
            }

        }
    }
}

// Функция отправляющее 1 сообщение в бота
async function sendNotifications(chatId, page, changed) {
    const created = new Date(page.created_time);
    const edited = new Date(page.last_edited_time);
    let assignee = ''
    page.properties.Assignee.people.forEach(people => {
        assignee.concat(' ', people.name);
    });

    let massage = `${changed ? 'Изменения в задаче ' : ''}${page.properties.Name.title[0].plain_text}\n\nСоздана: ${edited.toLocaleString("ru", timeOptions)} ${created.toLocaleString("en-US", dateOptions)}\nРедактирована: ${edited.toLocaleString("ru", timeOptions)} ${edited.toLocaleString("en-US", dateOptions)}\n\nСтатус: ${page.properties.Status.status.name}\nОтветственные:${assignee}\n\nURL: ${page.url}`;
    await bot.sendMessage(chatId, massage)
    console.log('\nОтправлено: ', edited);
}

// Функция для получения всех страниц из базы данных ноушена
async function getNotionNotifications(apiKey, databaseId) {
    console.log("\nЗапрос на серв\n")
    const notion = new Client({
        auth: apiKey,
    });
    const response = await notion.databases.query({
        database_id: databaseId,
        sorts: [
            {
                property: "title",
                direction: "ascending",
            },
        ],
    });

    return response.results;
}

// Функция сравнения двух массивов страниц базы данных ноушена
function change(array, newArray) {
    let counter = -1;
    let totalBreak = false;
    for (let i = 0; i < newArray.length; i++) {
        for (let j = 0; j < array.length; j++) {
            if (JSON.stringify(newArray[i]) === JSON.stringify(array[j])) {
                totalBreak = true;
                break;
            }
        }
        if (totalBreak) {
            break;
        }
        counter = i;
    }
    if (counter !== -1) {
        return newArray.slice(0, counter + 1);
    }
    else {
        return []
    }
}