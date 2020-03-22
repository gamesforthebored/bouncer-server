const PORT = process.env.PORT || 3000;
const express = require('express');
const server = express().listen(PORT, () => console.log(`Listening on ${PORT}`));
const { Server } = require('ws');
const wss = new Server({ server });

function generateUid() { return Math.random().toString(36).substring(2) + Date.now().toString(36); }
const channels = {};
const clientsByUid = {};

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.uid = generateUid(); // Custom attribute
  clientsByUid[ws.uid] = ws;
  
  ws.on('close', () => {
    console.log('Client disconnected')
    for (let channelName in channels) {
      if (channels[channelName][ws.uid]) {
        delete (channels[channelName])[ws.uid];
        let timestamp = new Date() - 0;
        for (let memberUid in channels[channelName]) {
          let memberWs = clientsByUid[memberUid];
          if (memberWs) {
            memberWs.send(JSON.stringify({
              type: msg.type == 'GOODBYE',
              timestamp: timestamp,
              channel: channelName,
              uid: ws.uid
            }));
          }
        }
      }
    }
    delete clientsByUid[ws.uid];
  });
  
  ws.on('message', (msgString) => {
    let msg;
    try {
      msg = JSON.parse(msgString);
    } catch(e) {
      ws.send(JSON.stringify({type: 'MALFORMED'}));
      return;
    }
    
    if (msg.type == 'MY_UID') {
      ws.send(JSON.stringify({type: 'YOUR_UID', uid: ws.uid}));
    } else if (msg.type == 'JOIN' || msg.type == 'QUIT' || msg.type == 'MEMBERS_QUERY') {
      let channelName = '' + msg.channel;
      if (channelName) {
        if (msg.type == 'JOIN' || msg.type == 'QUIT') {
          if (msg.type == 'JOIN') {
            if (!channels[channelName]) {
              channels[channelName] = {};
            } else {
              if (channels[channelName][ws.uid]) {
                // You cannot join a channel you are already in.
                ws.send(JSON.stringify({
                  type: 'JOIN_REJECTED',
                  timestamp: new Date() - 0,
                  channel: channelName
                }));
                return;
              }
            }
            channels[channelName][ws.uid] = true;
          } else if (!channels[channelName] || !channels[channelName][ws.uid]) {
            // You cannot quit a channel you are not in.
            ws.send(JSON.stringify({
              type: 'QUIT_REJECTED',
              timestamp: new Date() - 0,
              channel: channelName
            }));
            return;
          }
          
          let timestamp = new Date() - 0;
          for (let memberUid in channels[channelName]) {
            let memberWs = clientsByUid[memberUid];
            if (memberWs) {
              memberWs.send(JSON.stringify({
                type: msg.type == 'JOIN' ? 'HELLO' : 'GOODBYE',
                timestamp: timestamp,
                channel: channelName,
                uid: ws.uid
              }));
            }
          }

          if (msg.type == 'QUIT') {
            delete (channels[channelName])[ws.uid];
          }
          
        } else if (msg.type == 'MEMBERS_QUERY') {
          // You can only get the membership list for channels you are in.
          if (channels[channelName] && channels[channelName][ws.uid]) {
            ws.send(JSON.stringify({
              type: 'MEMBERS_ANSWER',
              timestamp: new Date()-0,
              channel: channelName,
              members: Object.keys(channels[channelName]).sort()
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'MEMBERS_REJECTED',
              timestamp: new Date() - 0,
              channel: channelName
            }));
          }
        }
      } else {
        ws.send(JSON.stringify({type: 'MALFORMED'}));
      }
    } else if (msg.type == 'SEND') {
      let channelName = '' + msg.channel;
      let payload = msg.payload;
      if (channelName && payload) {
        let timestamp = new Date() - 0;
        if (channels[channelName] && channels[channelName][ws.uid]) {
          for (let memberUid in channels[channelName]) {
            let memberWs = clientsByUid[memberUid];
            if (memberWs) {
              memberWs.send(JSON.stringify({
                type: 'BOUNCE',
                timestamp: timestamp,
                channel: channelName,
                sender: ws.uid,
                payload: payload
              }));
            }
          }
        } else {
          // You can't send a message to a channel unless you are in it.
          ws.send(JSON.stringify({
            type: 'SEND_REJECTED',
            timestamp: timestamp,
            channel: channelName
          }));
        }
      } else {
        ws.send(JSON.stringify({type: 'MALFORMED'}));
      }
    } else if (msg.type == 'PING') {
      // This just keeps the websocket connection alive
      ws.send(JSON.stringify({type: 'PONG'}));
    } else {
      ws.send(JSON.stringify({type: 'MALFORMED'}));
    }
  });
});
