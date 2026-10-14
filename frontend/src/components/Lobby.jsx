import React, { useState } from 'react';
import { socket } from '../utils/socket';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { Disc, Play, Radio, Volume2, ShieldAlert, Cpu, Sparkles } from 'lucide-react';

/**
 * Animated Cassette Tape Visualizer Component
 */
const CassetteTapeGraphic = ({ isSpinning = true }) => {
  return (
    <div className="relative w-full max-w-[340px] mx-auto h-[180px] bg-[#1a1c20] border-4 border-[#2c323b] rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.8)] p-3 flex flex-col justify-between overflow-hidden">
      {/* Corner Hardware Screws */}
      <div className="screw absolute top-2 left-2" />
      <div className="screw absolute top-2 right-2" />
      <div className="screw absolute bottom-2 left-2" />
      <div className="screw absolute bottom-2 right-2" />

      {/* Retro Cassette Sticker Label */}
      <div className="relative z-10 bg-[#e7dfd3] text-[#1a1c20] rounded-lg p-2.5 shadow-inner border border-[#b8ae9c]">
        {/* Cassette Striping */}
        <div className="flex items-center gap-1 mb-1">
          <div className="h-2 w-8 bg-[#ff5500] rounded-xs" />
          <div className="h-2 w-4 bg-[#ffb000] rounded-xs" />
          <div className="h-2 flex-1 bg-[#1a1c20] rounded-xs" />
          <span className="text-[10px] font-['Chakra_Petch'] font-bold tracking-widest text-[#ff5500]">
            TYPE-II // CrO2
          </span>
        </div>

        <div className="flex justify-between items-center text-[11px] font-bold tracking-wider font-['Share_Tech_Mono']">
          <span className="bg-[#1a1c20] text-[#e7dfd3] px-1.5 py-0.5 rounded text-[10px]">
            SIDE A
          </span>
          <span className="truncate uppercase font-['Chakra_Petch'] font-bold text-xs tracking-wide">
            CF-1984 GESTURE LINK
          </span>
          <span className="text-[10px] text-[#ff5500]">C-60</span>
        </div>
      </div>

      {/* Cassette Tape Reel Window */}
      <div className="relative z-10 my-1 bg-[#0d0f12] border-2 border-[#38404b] rounded-xl h-[68px] flex items-center justify-between px-8 shadow-inner">
        {/* Left Reel */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-11 h-11 rounded-full border-2 border-[#e5dfd3] bg-[#22272e] flex items-center justify-center shadow-md ${
              isSpinning ? 'animate-tape-spin' : ''
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-[#0d0f12] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#e5dfd3] rounded-full" />
            </div>
            {/* Reel Teeth */}
            <div className="absolute w-full h-1 bg-[#e5dfd3]/40" />
            <div className="absolute h-full w-1 bg-[#e5dfd3]/40" />
          </div>
        </div>

        {/* Center Tape Magnetic Tape Ribbon View */}
        <div className="flex flex-col items-center">
          <div className="text-[9px] font-['VT323'] text-[#ffb000] tracking-widest">
            TAPE COUNTER
          </div>
          <div className="bg-[#000] border border-[#ffb000]/60 px-2 py-0.5 rounded text-[#ffb000] font-['VT323'] text-lg tracking-widest leading-none shadow-[0_0_8px_rgba(255,176,0,0.5)]">
            04:20
          </div>
        </div>

        {/* Right Reel */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-11 h-11 rounded-full border-2 border-[#e5dfd3] bg-[#22272e] flex items-center justify-center shadow-md ${
              isSpinning ? 'animate-tape-spin' : ''
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-[#0d0f12] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-[#e5dfd3] rounded-full" />
            </div>
            <div className="absolute w-full h-1 bg-[#e5dfd3]/40" />
            <div className="absolute h-full w-1 bg-[#e5dfd3]/40" />
          </div>
        </div>
      </div>

      {/* Cassette Trapezoid Base */}
      <div className="w-48 h-3.5 mx-auto bg-[#252b33] rounded-t-sm border-t border-[#3f4957] flex items-center justify-around px-4">
        <div className="w-1.5 h-1.5 bg-[#121417] rounded-full" />
        <div className="w-8 h-1 bg-[#121417] rounded" />
        <div className="w-1.5 h-1.5 bg-[#121417] rounded-full" />
      </div>
    </div>
  );
};

export default function Lobby({ onEnterRoom }) {
  const [username, setUsername] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [targetScore, setTargetScore] = useState(3);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { playMechanicalClick } = useSoundEffects();

  const getSanitizedUsername = () => {
    return username.trim() || `OPERATOR_${Math.floor(100 + Math.random() * 900)}`;
  };

  const handleCreateRoom = () => {
    playMechanicalClick();
    setLoading(true);
    setErrorMessage('');
    const finalName = getSanitizedUsername();

    if (!socket.connected) socket.connect();

    socket.emit('create-room', { username: finalName, targetScore: Number(targetScore) }, (res) => {
      setLoading(false);
      if (res && res.success) {
        onEnterRoom(res.roomCode, finalName);
      } else {
        setErrorMessage(res?.message || 'TRANSMISSION ERROR: Failed to allocate frequency.');
      }
    });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    playMechanicalClick();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setErrorMessage('INPUT ERROR: 6-Character Frequency code required.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    const finalName = getSanitizedUsername();

    if (!socket.connected) socket.connect();

    socket.emit('join-room', { roomCode: code, username: finalName }, (res) => {
      setLoading(false);
      if (res && res.success) {
        onEnterRoom(code, finalName);
      } else {
        setErrorMessage(res?.message || 'CHANNEL UNREACHABLE: Verify frequency code.');
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#111316] text-[#e5dfd3] flex flex-col justify-center items-center p-4 selection:bg-[#ffb000] selection:text-black">
      {/* Background CRT scanline ambient */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#ffb000_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="max-w-lg w-full relative z-10 flex flex-col gap-5">
        {/* Console Chassis Outer Shell */}
        <div className="relative bg-[#1c2026] border-4 border-[#2b323c] rounded-3xl p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.9),inset_0_2px_4px_rgba(255,255,255,0.1)]">
          {/* Chassis Corner Hardware Screws */}
          <div className="screw absolute top-3 left-3" />
          <div className="screw absolute top-3 right-3" />
          <div className="screw absolute bottom-3 left-3" />
          <div className="screw absolute bottom-3 right-3" />

          {/* Industrial Top Plate / System Header */}
          <div className="flex items-center justify-between border-b-2 border-[#2f3742] pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 rounded-full bg-[#33ff55] shadow-[0_0_12px_#33ff55] animate-pulse" />
              <div>
                <h1 className="font-['Chakra_Petch'] text-2xl font-black tracking-wider text-[#e5dfd3] uppercase flex items-center gap-2">
                  MOTION RPS <span className="text-[#ff6b35] text-xs font-['VT323'] text-lg px-2 py-0.5 bg-[#2d1808] border border-[#ff6b35]/60 rounded">CF-1984</span>
                </h1>
                <p className="text-[11px] font-['Share_Tech_Mono'] text-[#9aa0a6] uppercase tracking-wider">
                  Optical Gesture Telemetry // P2P Peer Terminal
                </p>
              </div>
            </div>

            {/* Industrial Hazard Badge */}
            <div className="hidden sm:flex flex-col items-end">
              <div className="h-3 w-16 hazard-stripes border border-black/40 rounded-xs mb-1" />
              <span className="text-[9px] font-['VT323'] text-[#ffb000] tracking-widest">
                SYS.RDY // 1200 BAUD
              </span>
            </div>
          </div>

          {/* Animated Cassette Tape Visualizer */}
          <div className="mb-6">
            <CassetteTapeGraphic isSpinning={true} />
          </div>

          {/* Error Message Teletype */}
          {errorMessage && (
            <div className="mb-4 bg-[#260e11] border-2 border-[#e63946] text-[#ff808a] px-4 py-2.5 rounded-xl text-xs font-['Share_Tech_Mono'] flex items-center gap-2 shadow-[0_0_15px_rgba(230,57,70,0.4)]">
              <ShieldAlert size={16} className="text-[#e63946] flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Recessed Control Bay */}
          <div className="bg-[#14171b] border-2 border-[#0d0f12] rounded-2xl p-5 shadow-bezel-inner space-y-5">
            {/* Operator Identifier Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-[11px] uppercase font-['Chakra_Petch'] font-bold tracking-widest text-[#cfc6b4]">
                  OPERATOR IDENTIFIER [CALLSIGN]
                </label>
                <span className="text-[10px] text-[#ffb000] font-['VT323'] text-sm tracking-wider">
                  [INPUT: TEXT]
                </span>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="OPERATOR_X1"
                maxLength={18}
                className="w-full bg-[#0a0c0e] border-2 border-[#2b323c] rounded-xl px-4 py-2.5 text-[#33ff55] font-['Share_Tech_Mono'] text-sm placeholder-[#2d5236] focus:outline-none focus:border-[#33ff55] focus:shadow-[0_0_12px_rgba(51,255,85,0.3)] transition-all"
              />
            </div>

            {/* SECTION 1: Transmit / Create Frequency */}
            <div className="p-3.5 rounded-xl bg-[#1b2026] border border-[#2e3742] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-['Chakra_Petch'] font-bold text-[#ffb000] flex items-center gap-1.5">
                  <Radio size={14} /> HOST NEW TRANSMISSION
                </span>
                {/* Target Score Rotary Select */}
                <select
                  value={targetScore}
                  onChange={(e) => {
                    playMechanicalClick();
                    setTargetScore(e.target.value);
                  }}
                  className="bg-[#0d0f12] border border-[#39424e] text-xs rounded-lg px-2 py-1 text-[#ffb000] font-['Share_Tech_Mono'] focus:outline-none"
                >
                  <option value={2}>BEST OF 3 (2 PTS)</option>
                  <option value={3}>BEST OF 5 (3 PTS)</option>
                  <option value={5}>BEST OF 9 (5 PTS)</option>
                </select>
              </div>

              {/* Physical Orange Tactile Push Button */}
              <button
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-['Chakra_Petch'] font-bold text-sm uppercase tracking-wider text-white btn-tactile-orange flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={16} fill="white" /> INITIALIZE ROOM FREQUENCY
              </button>
            </div>

            {/* Hardware Divider with LED VU Meter */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-0.5 bg-[#252b33]" />
              <div className="flex gap-1">
                <span className="w-2.5 h-1.5 bg-[#33ff55] rounded-xs shadow-[0_0_4px_#33ff55]" />
                <span className="w-2.5 h-1.5 bg-[#33ff55] rounded-xs" />
                <span className="w-2.5 h-1.5 bg-[#ffb000] rounded-xs" />
                <span className="w-2.5 h-1.5 bg-[#ff6b35] rounded-xs" />
              </div>
              <span className="text-[11px] font-['VT323'] text-[#9aa0a6] uppercase tracking-widest text-base">
                OR
              </span>
              <div className="flex-1 h-0.5 bg-[#252b33]" />
            </div>

            {/* SECTION 2: Receiver / Join Frequency */}
            <form onSubmit={handleJoinRoom} className="space-y-3">
              <label className="block text-[11px] uppercase font-['Chakra_Petch'] font-bold tracking-widest text-[#cfc6b4]">
                TUNE CHANNEL [6-CHAR CODE]
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  maxLength={6}
                  className="w-1/2 bg-[#0a0c0e] border-2 border-[#2b323c] rounded-xl px-3 py-2.5 text-center text-[#ffb000] font-['VT323'] text-2xl tracking-widest uppercase focus:outline-none focus:border-[#ffb000] focus:shadow-[0_0_12px_rgba(255,176,0,0.3)] placeholder:text-[#3d321d]"
                />
                <button
                  type="submit"
                  disabled={loading || joinCode.trim().length !== 6}
                  className="flex-1 rounded-xl font-['Chakra_Petch'] font-bold text-xs uppercase tracking-wider text-[#e5dfd3] btn-tactile disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Disc size={15} /> LOCK FREQUENCY
                </button>
              </div>
            </form>
          </div>

          {/* Retro Manual Placard / Operation Guide */}
          <div className="mt-5 pt-4 border-t border-[#2a303a] flex items-center justify-between text-[11px] text-[#9aa0a6] font-['Share_Tech_Mono']">
            <span className="flex items-center gap-1.5">
              <Cpu size={14} className="text-[#33ff55]" /> OPTICAL SENSORS ACTIVE
            </span>
            <span className="text-[#ffb000]">ROCK • PAPER • SCISSORS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
