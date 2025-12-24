const axios = require('axios');

const url = 'https://www.geeksforgeeks.org/java/introduction-to-java/';

axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
}).then(response => {
    console.log(response.data);
}).catch(error => {
    console.error('Error fetching URL:', error);
});
