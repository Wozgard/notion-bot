/* ============================================= 
Скрипт для проверки ответов от базы данных ноушен 
================================================*/

const { Client } = require("@notionhq/client")
const notionApi = 'secret_XXXXXXXXXXXXXXXXXXXXX';
const notionDB = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

getNotionNotifications(notionApi, notionDB).then(res => {
    res.results.forEach(page => {
        console.log("")
        console.log(JSON.stringify(page));
        console.log("")
    });
});

async function getNotionNotifications(apiKey, databaseId) {
    console.log(apiKey)
    console.log(databaseId)
    const notion = new Client({
        auth: apiKey,
    });
    console.log('   ')
    const response = await notion.databases.query({
        database_id: databaseId,
        sorts: [
            {
                property: "title",
                direction: "ascending",
            },
        ],
    });

    return response;
}