const WebSocketServer = require("websocket").server;
const http = require("http");

const server = http.createServer((request, response) => {
  console.log(new Date() + " Received request for " + request.url);
  response.writeHead(404);
  response.end();
});
server.listen(8080, () => {
  console.log(new Date() + " Server is listening on port 8080");
});

wsServer = new WebSocketServer({
  httpServer: server,
  // You should not use autoAcceptConnections for production
  // applications, as it defeats all standard cross-origin protection
  // facilities built into the protocol and the browser.  You should
  // *always* verify the connection's origin and decide whether or not
  // to accept it.
  autoAcceptConnections: false,
});

const originIsAllowed = (origin) => {
  // put logic here to detect whether the specified origin is allowed.
  return true;
};

const clients = [];
let client = {};
const users = {};

wsServer.on("request", (request) => {
  if (!originIsAllowed(request.origin)) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log(
      new Date() + " Connection from origin " + request.origin + " rejected."
    );
    return;
  }

  const connection = request.accept(null, request.origin);
  console.log(new Date() + " Connection accepted.");
  connection.on("message", (message) => {
    if (message.type === "utf8") {
      const messageReceived = JSON.parse(message.utf8Data);
      switch (messageReceived.type) {
        case "addUser":
          {
            const { user } = messageReceived;
            if (user?.name) {
              const { userId } = user;
              if (!users[userId]) {
                users[userId] = user;
                console.log("INNN!!!!");
                client = { user, connection, messages: [] };
                console.log(client.user, client.user.userId, "Connected");
                clients.push(client);
                clients.forEach(({ connection, user, messages }) =>
                  connection.sendUTF(JSON.stringify({ user, users, messages }))
                );
              }
            }
          }
          break;
        case "sendMessage":
          {
            const { message } = messageReceived;
            clients.forEach(({ user, messages, connection }) => {
              if ([message.to, message.sentBy].includes(user.userId)) {
                messages.push(message);
                connection.sendUTF(JSON.stringify({ user, users, messages }));
              }
            });
          }
          break;

        default:
          break;
      }
    } else if (message.type === "binary") {
      console.log(
        "Received Binary Message of " + message.binaryData.length + " bytes"
      );

      clients.forEach((client) => client.sendBytes(message.binaryData));
    }
  });
  connection.on("close", () => {
    console.log(
      new Date() + " Peer " + connection.remoteAddress + " disconnected."
    );
    const index = clients.indexOf(client);
    if (index > -1) {
      const { userId } = client.user;
      if (userId) delete users[userId];
      clients.splice(index, 1);
      clients.forEach(({ connection, user }) =>
        connection.sendUTF(JSON.stringify({ user, users }))
      );
      console.log("user disconnected", client.user);
    }
  });
});
