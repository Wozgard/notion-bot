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
    bot.sendMessage(msg.chat.id, 'Привет! Чтобы получать уведомления из Notion, введи /notifi, если не хотите получать рассылку, но хотите посмотреть последние изменения введите /last_notofi');
});

// Подписывает человека на рассылку уведомлений
bot.onText(/\/notifi/, (msg) => {
    // Проверяем есть ли уже у нас такой чат айди, если нет - добавляем и записываем в файл
    if (!chatsId.includes(msg.chat.id)) {
        chatsId.push(msg.chat.id);

        let jsonChats = JSON.stringify(chatsId);
        fs.writeFile(fileName, jsonChats, function (err) {
            if (err) throw err;
            console.log('Data saved to file');
        });
        bot.sendMessage(msg.chat.id, 'Вы успешно подписались на рассылку уведомлений');
    }
    else {
        bot.sendMessage(msg.chat.id, 'Вы уже подписаны на рассылку уведомлений, если хотите отписаться, отправьте /stop_notofi');
    }
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

bot.onText(/\/last_notofi/, (msg) => {
    for (let notifi = 4; notifi >= 0; notifi--) {
        sendNotifications(msg.chat.id, currentResults[notifi]);
    }
});

startNotifications()
console.log('Telegram-бот запущен');

// =========================================== Функции ============================================================
async function startNotifications() {
    // Получаем массив страниц из базы данных ноушен
    let currentResults = await getNotionNotifications(process.env.NOTION_API_KEY, process.env.NOTION_DATABASE_ID);
    // Соритруем по времени редактирования
    currentResults.sort((a, b) => a.last_edited_time > b.last_edited_time ? 1 : -1).reverse();
    setInterval(compareNotificationAndSendDifference, 5 * 60 * 1000);
}

async function compareNotificationAndSendDifference() {
    let newResults = await getNotionNotifications(process.env.NOTION_API_KEY, process.env.NOTION_DATABASE_ID);
    // Также сортируем его
    newResults.sort((a, b) => a.last_edited_time > b.last_edited_time ? 1 : -1).reverse();

    // Проверяем есть ли изменения относительно предыдущего массива страниц
    let updates = compare(currentResults, newResults);
    console.log(updates)
    if (updates.length > 0) {
        console.log('===========UPDATES===========')
        // Отправляем все измененные страницы
        sendNotificationsLoop(updates, updates.length - 1)
        currentResults = newResults;
    }
}

// Асинхронная функция для поочередной отправки сообщений в бота
async function sendNotificationsLoop(pages, notofiCount) {
    for (let notifi = notofiCount; notifi >= 0; notifi--) {
        for (let chat = 0; chat < chatsId.length; chat++) {
            await sendNotifications(chatsId[chat], pages[notifi]);
            let time = new Date(pages[notifi].last_edited_time);
            console.log('\n', time);
        }
    }
}

// Функция отправляющее 1 сообщение в бота
async function sendNotifications(chatId, page) {
    const created = new Date(page.created_time);
    const edited = new Date(page.last_edited_time);
    let assignee = ''
    page.properties.Assignee.people.forEach(people => {
        assignee.concat(' ', people.name);
    });

    let massage = `Изменения в задаче "${page.properties.Name.title[0].plain_text}"\n\nСоздана: ${edited.toLocaleString("ru", timeOptions)} ${created.toLocaleString("en-US", dateOptions)}\nРедактирована: ${edited.toLocaleString("ru", timeOptions)} ${edited.toLocaleString("en-US", dateOptions)}\n\nСтатус: ${page.properties.Status.status.name}\nОтветственные:${assignee}\n\nURL: ${page.url}`;
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
function compare(array, newArray) {
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