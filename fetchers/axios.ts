import axios from 'axios'
import https from 'https'

const axiosInstance = axios.create({
    timeout: 5000,
    headers: {
        Authorization: `Bearer ${process.env.CMOTS_TOKEN}`,
        'Content-Type': 'application/json',
    },
    httpsAgent: new https.Agent({
        keepAlive: true,
    }),
})

export default axiosInstance
