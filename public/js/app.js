$(function() {
  $(window).on('resize', function() {
    var clientHeight = document.documentElement.clientHeight;
    $('.app-user-list-body').height(clientHeight - 210);
    $('.app-chat-body').height(clientHeight - 100);
  }).resize();

  // 定义变量
  var nickName;
  var $appChatContent = $('.app-chat-content');
  var $elTemplate = $('#el_template');
  var $elInputMsg = $('#el_input_msg');
  var $elBtnSend = $('#el_btn_send');
  var $elBtnSendfile = $('#el_btn_sendfile');
  var $elUserList = $('#table_userlist');
  var $elBtnFileSend = $('#el_btn_file_send');
  var $elBtnFileCancel = $('#el_btn_file_cancel');
  var $elFileUploadElements = $('.app-file-container, .backup');
  var client = io.connect('http://localhost:8000', {
    reconnectionAttempts: 3, //重连次数
    reconnection: false, //是否重连
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 2000, //超时时间
    autoConnect: true //自动连接
  });
  
  var clientForNewNsp = io.connect('http://localhost:8000/nsp1');
  clientForNewNsp.on('connect', function(){
    console.log('clientForNewNsp connect server succeed.');
  });

  // 工具方法
  function writeMsg(type, msg, time, title, isSelf) {
    console.log(isSelf);
    title = title || (type === 'system' ? '系统消息' : 'User');
    var template = $elTemplate.html()
      .replace('${title}', title)
      .replace('${bgClass}', type === 'system' ? 'label-danger' : 'label-info')
      .replace(/\${pullRight}/g, isSelf ? 'pull-right' : '')
      .replace('${textRight}', isSelf ? 'text-right' : 'aaaa')
      .replace('${info-icon}', type === 'system' ? 'glyphicon-info-sign' : 'glyphicon-user')
      .replace('${time}', time)
      .replace('${msg}', msg);
    $appChatContent.append($(template));
  }
  
  function sendMsg(msg, type){
    var msgObj = {
      type: type || 'text',
      data: msg,
      clientId: client.id
    };
    client.emit('server.newMsg', msgObj);
  }

  $elBtnSend.on('click', function() {
    var value = $elInputMsg.val();
    if (value) {
      sendMsg(value);
      $elInputMsg.val('');
    }
  });
  $elBtnSendfile.on('click', function(){
     $elFileUploadElements.show();
  });
  $elBtnFileCancel.on('click', function(){
    $elFileUploadElements.hide();
  });
  $elBtnFileSend.on('click', function(){
    var files = document.getElementById('el_file').files;
    if(files.length === 0){
      return window.alert('文件不能为空！');
    }
    var file = files[0];
    //发送文件
    client.emit('server.sendfile', {
      clientId: client.id,
      file: file,
      fileName: file.name
    });
    $elFileUploadElements.hide();
  });
  $(document).on('paste', function(e){
    var originalEvent =  e.originalEvent;
    var items;
    if(originalEvent.clipboardData && originalEvent.clipboardData.items){
      items = originalEvent.clipboardData.items;
    }
    if(items){
      for(var i = 0, len = items.length; i< len; i++){
        var item = items[i];
        if(item.kind === 'file'){
          var pasteFile = item.getAsFile();
          if(pasteFile.size > 1024 * 1024){
            return;
          }
          var reader = new FileReader();
          reader.onloadend = function(){
            var imgBase64Str = reader.result;
            sendMsg(imgBase64Str, 'image');
          }
          //读取数据
          reader.readAsDataURL(pasteFile);
        }
      }
    }
  });

  //输入昵称
  // do {
    nickName = prompt('请输入您的昵称：');
  // } while (!nickName);
  $('#span_nickname').text(nickName);
  client.emit('server.online', nickName);
  console.log(client);

  client.on('client.newMsg', function(msgObj) {
    if(msgObj.type === 'image'){
      msgObj.data = '<img src="' + msgObj.data + '" alt="image" >';
    }
    writeMsg('user', msgObj.data, msgObj.time, msgObj.nickName, msgObj.clientId === client.id);
    $appChatContent[0].scrollTop = $appChatContent[0].scrollHeight;
  });

  client.on('client.online', function(nickName,time) {
    writeMsg('system', '[' + nickName + '] 上线了',time);
  });
  
  client.on('client.offline', function(nickName,time) {
    writeMsg('system', '[' + nickName + '] 下线了', time);
  });
  
  client.on('client.joinroom', function(msgObj){
    writeMsg('user', '我加入了房间' + msgObj.roomId, msgObj.time, msgObj.nickName);
  });
  
  client.on('client.onlinetList', function(userList){
    $elUserList.find('tr').not(':eq(0)').remove();
    userList.forEach(function(userNick){
      var $tr = $('<tr><td>' + userNick + '</td></tr>');
      $elUserList.append($tr);
    });
  });
  var intervalId = setInterval(function(){
    client.emit('server.getOnlineList');
    //如果client断开，那么就停止刷新在线列表
    // if(client){
    //   clearInterval(intervalId);
    // }
  }, 4 * 1000);
  
  client.on('client.file', function(fileMsgObj){
    var content = '文件：<a href="/files/' + fileMsgObj.data + '">' + fileMsgObj.data + '</a>';
    writeMsg('user', content,fileMsgObj.time, fileMsgObj.nickName, client.id === fileMsgObj.clientId);
  });
  
  client.on('error', function(err) {
    console.log(err);
  });
  client.on('connect', function() {
    console.log('connect');
  });
  client.on('disconnect', function(err) {
    console.log('disconnect', err);
  });
  client.on('reconnect', function(count) {
    console.log('reconnect', count);
  });
  client.on('reconnect_attempt', function(count) {
    console.log('reconnect_attempt', count);
  });
  client.on('reconnecting', function(count) {
    console.log('reconnecting', count);
  });
  client.on('reconnect_error', function(err) {
    console.log('reconnect_error', err);
  });
  client.on('reconnect_failed', function() {
    console.log('reconnect_failed');
  });
});
