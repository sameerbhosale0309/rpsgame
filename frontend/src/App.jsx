import React, { useState } from 'react';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';
import { socket } from './utils/socket';

export default function App() {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [username, setUsername] = useState('');

  const handleEnterRoom = (roomCode, playerName) => {
    setCurrentRoom(roomCode);
    setUsername(playerName);
  };

  const handleLeaveRoom = () => {
    if (socket.connected) {
      socket.disconnect();
    }
    setCurrentRoom(null);
  };

  return (
    <div className="w-full min-h-screen bg-[#080914]">
      {!currentRoom ? (
        <Lobby onEnterRoom={handleEnterRoom} />
      ) : (
        <GameRoom
          roomCode={currentRoom}
          username={username}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </div>
  );
}
