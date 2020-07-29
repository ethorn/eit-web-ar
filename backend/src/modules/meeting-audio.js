module.exports = {
  init: function(io) {

    io.on('connect', (socket) => {
      console.log('meeting-audio connection: ' + socket.id);

      socket.on('AudioClientMessage', (data) => {
        // console.log('received: %s', data);
        io.emit('AudioServerMessage', data);
      });
    });
  },
}