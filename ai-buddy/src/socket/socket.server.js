const {Server} = require('socket.io'); 
const jsonwebtoken = require('jsonwebtoken');
const cookie = require('cookie');
const agent = require('../agent/agent')

async function initSocketServer(httpServer) {
    const io = new Server(httpServer, {});

    io.use((socket, next) => {
          const cookies = socket.handshake.headers?.cookie;

          const {token} = cookies ? cookie.parse(cookies) : {};

          if (!token) {
            return next(new Error('Authentication error: No token provided'));
          }

          try{
            const decoded = jsonwebtoken.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            socket.token = token;
            next();
          }catch(err){
            return next(new Error('Authentication error: Invalid token'));
          }
    })

    io.on('connection', (socket) => {
        console.log(socket.user, socket.token)

        socket.on('message',async (message) => {
            // Handle incoming messages from the client
            const agentResponse =  await agent.invoke({
                messages: [
                  {
                    role: 'user',
                    content: message,
                  }
                ]
            },{
                metadata: {token: socket.token},
                configurable: {token: socket.token}
            }) 
            const lastMessage = agentResponse.messages[agentResponse.messages.length-1]
            socket.emit('message', lastMessage.content);
        })
    });
}

module.exports = {initSocketServer};