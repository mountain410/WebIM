'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var express = require('express');
var SocketIo = require('socket.io');

var roomMap = {
  '小刘': 'roomA',
  '小胡': 'roomA',
  '小王': 'roomA',
  '小邵': 'roomB',
};

var getRoom = (userId) => {
  return roomMap[userId] || 'default-room';
};

var isRoom = (roomId) => {
  return ['roomA', 'roomB'].indexOf(roomId) >= 0;
}

var app = express();
app.use(express.static(path.join(__dirname, './public')));
var server = http.Server(app);
var io = new SocketIo(server, {
    pingTimeout: 1000 * 10, //default 1000 * 60,超时时间
    pingInterval: 1000 * 2, //default 1000 * 2.5 ping的频率
    transports: ['websocket', 'polling'],
    allowUpgrades: true, //default true, 传输方式是否允许升级
    httpCompression: true, //default true,使用加密
    path: '/socket.io', //提供客户端js的路径
    serveClient: false //是否提供客户端js（socket.io-client）
});

function nowTime() {
  var date = new Date(),
      year = date.getFullYear(),
      month = date.getMonth() + 1,
      strDate = deal(date.getDate()),
      hours = deal(date.getHours()),
      min = deal(date.getMinutes()),
      seconds = deal(date.getSeconds());
  var currentDate,currentTime;
  if (month >= 1 && month <= 9) {
      month = "0" + month;
  }
  function deal(a){
  	if (a >= 0 && a <= 9) {
      a = "0" + a;
  	}
  	return a;
  }
  currentDate = year + "-" + month + "-" + strDate;
  currentTime = hours +":"+ min +":"+ seconds;
  return currentTime;
}

//用户认证
io.set('authorization', (handshakeData, accept) => {
  if(handshakeData.headers.cookie){
    handshakeData.headers.userId = Date.now();
    accept(null, true);
  }else{
    accept('Authorization Error', false);
  }
});
var usersMap = new Map();
var getUserList = (userMap) => {
  var userList = [];
  for(let client of usersMap.values()){
    userList.push(client.nickName);
  }  
  return userList;
}
io.on('connection', (socket) => {
  socket.on('serverEvents.send', (data) => {
    // console.log(data);
  });
  
  socket.on('server.online', (nickName) => {
    socket.nickName = nickName;
    //设置昵称的时候，加入房间
    var roomId = getRoom(nickName);
    socket.join(roomId);
    // console.log(`${nickName} 加入了房间 ${roomId}`);
    // console.log('roomId', Object.keys(socket.adapter.rooms), '=> socketId', socket.id);
    //socket.leave(roomId); //离开房间
    socket.broadcast.emit('client.online', nickName, nowTime());
    //发送一个加入房间的通知
    socket.emit('client.joinroom', {nickName: nickName, roomId: roomId, time: nowTime()});
  });
  socket.on('server.newMsg', (msgObj) => {
    msgObj.time = nowTime();
    msgObj.nickName = socket.nickName;
    if(msgObj.type === 'text'){
      var splitPoint = msgObj.data.indexOf(':');
      if(splitPoint > 0){
        var roomId = msgObj.data.substring(0, splitPoint);
        if(isRoom(roomId)){
          var msg = msgObj.data.substring(splitPoint + 1);
          msgObj.data = msg;
          io.to(roomId).emit('client.newMsg', msgObj);
          return;
        }
      }
    }
    io.emit('client.newMsg', msgObj);
  });
  usersMap.set(socket.id, socket);
  socket.on('server.getOnlineList', () => {
    socket.emit('client.onlinetList', getUserList(usersMap));
  });
  
  socket.on('server.sendfile', (fileMsgObj) => {
    var filePath = path.resolve(__dirname, `./public/files/${fileMsgObj.fileName}`);
    fs.writeFileSync(filePath, fileMsgObj.file, 'binary');
    io.emit('client.file', {
      nickName: socket.nickName,
      time: nowTime(),
      data: fileMsgObj.fileName,
      clientId: fileMsgObj.clientId
    });
  });
  
  socket.on('disconnect', () => {
    usersMap.delete(socket.id);
    socket.broadcast.emit('client.offline', socket.nickName,nowTime());
  });
  usersMap.set(socket.id, socket);
  // setInterval(()=>{
  //   socket.emit('clientEvents.welcome', '当前服务器时间，' + new Date());
  // }, 1333);
  //io.emit('online', socket.id);
  //io.sockets.emit('online', socket.id);
  socket.broadcast.emit('online', socket.id);
  // for(let client of usersMap.values()){
  //   if(client.id !== socket.id){
  //     client.emit('online', 'Welcome');
  //   }
  // }  
});

//创建命名空间
var newNsp = io.of('/nsp1');
newNsp.on('connection', (socket) => {
  console.log('newNsp client connected.');
  //io.emit('test', 'message from nsp1');
});

server.listen('8000', (err) => {
    if(err){
        return console.error(err);
    }
    console.log('Server started, listening port %s', server.address().port);
}); 