import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, Award, XCircle, MinusCircle, Disc, Terminal } from 'lucide-react';
import { useSoundEffects } from '../hooks/useSoundEffects';

export default function MatchSummaryModal({ data, isPlayer1, onPlayAgain, onLeave }) {
  const { finalWinner, winnerUsername, finalScores, roundHistory = [] } = data;
  const { playMechanicalClick } = useSoundEffects();

  const isLocalWinner =
    (isPlayer1 && finalWinner === 'PLAYER_1') || (!isPlayer1 && finalWinner === 'PLAYER_2');
  const isDraw = finalWinner === 'DRAW';

  useEffect(() => {
    if (isLocalWinner) {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#33ff55', '#ffb000', '#ff5500', '#e5dfd3'],
      });
    }
  }, [isLocalWinner]);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      {/* Telemetry Printout Box */}
      <div className="relative bg-[#191d24] border-4 border-[#2c333e] rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-[0_0_80px_rgba(0,0,0,0.95)] text-center animate-fade-in font-['Share_Tech_Mono']">
        {/* Hardware Corner Screws */}
        <div className="screw absolute top-3 left-3" />
        <div className="screw absolute top-3 right-3" />
        <div className="screw absolute bottom-3 left-3" />
        <div className="screw absolute bottom-3 right-3" />

        {/* Top Header Tag */}
        <div className="flex items-center justify-center gap-2 text-xs font-['VT323'] text-lg text-[#ffb000] tracking-widest mb-3">
          <Terminal size={16} /> CF-1984 MISSION TELEMETRY PRINTOUT
        </div>

        {/* Vintage Award Medallion */}
        <div className="flex justify-center mb-3">
          {isLocalWinner ? (
            <div className="w-18 h-18 rounded-2xl bg-[#0e2413] border-3 border-[#33ff55] flex items-center justify-center text-[#33ff55] shadow-[0_0_30px_rgba(51,255,85,0.6)]">
              <Trophy size={40} />
            </div>
          ) : isDraw ? (
            <div className="w-18 h-18 rounded-2xl bg-[#1d190e] border-3 border-[#ffb000] flex items-center justify-center text-[#ffb000]">
              <MinusCircle size={40} />
            </div>
          ) : (
            <div className="w-18 h-18 rounded-2xl bg-[#290d10] border-3 border-[#ff5500] flex items-center justify-center text-[#ff5500]">
              <XCircle size={40} />
            </div>
          )}
        </div>

        {/* Result Header */}
        <h2 className="font-['Chakra_Petch'] text-3xl font-black tracking-wider text-white uppercase">
          {isLocalWinner ? (
            <span className="text-[#33ff55] glow-green">MISSION VICTORY</span>
          ) : isDraw ? (
            <span className="text-[#ffb000] glow-amber">STALEMATE // DRAW</span>
          ) : (
            <span className="text-[#ff5500] glow-orange">DEFEAT RECORDED</span>
          )}
        </h2>

        <p className="text-xs text-[#9aa0a6] mt-1">
          {isLocalWinner
            ? 'SUPERIOR OPTICAL ACCURACY. FREQUENCY DEFENDED.'
            : `OPERATOR [${winnerUsername}] SECURED VICTORY FREQUENCY.`}
        </p>

        {/* Score Counters */}
        <div className="my-5 inline-flex items-center gap-6 px-6 py-2.5 rounded-2xl bg-[#0d0f12] border-2 border-[#2b323c] shadow-inner">
          <div className="text-center">
            <p className="text-[10px] text-[#9aa0a6] uppercase font-['Chakra_Petch'] font-bold">OP1 (YOU)</p>
            <p className="font-['VT323'] text-4xl font-bold text-[#33ff55] leading-none glow-green">
              {isPlayer1 ? finalScores?.player1 : finalScores?.player2}
            </p>
          </div>
          <div className="text-[#ffb000] font-['VT323'] text-2xl font-bold tracking-widest">:</div>
          <div className="text-center">
            <p className="text-[10px] text-[#9aa0a6] uppercase font-['Chakra_Petch'] font-bold">OP2 (PEER)</p>
            <p className="font-['VT323'] text-4xl font-bold text-[#ff5500] leading-none glow-orange">
              {isPlayer1 ? finalScores?.player2 : finalScores?.player1}
            </p>
          </div>
        </div>

        {/* Telemetry Log Table */}
        <div className="text-left mb-6">
          <div className="flex justify-between items-center mb-1.5">
            <h4 className="text-[10px] uppercase font-['Chakra_Petch'] font-bold tracking-widest text-[#cfc6b4]">
              ROUND TELEMETRY LOGS
            </h4>
            <span className="text-[9px] font-['VT323'] text-[#ffb000]">CH.A / CH.B</span>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border-2 border-[#2b323c] rounded-xl p-2 bg-[#0d0f12]">
            {roundHistory.map((round, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-[#14171b] border border-[#232932]"
              >
                <span className="font-['VT323'] text-sm text-[#ffb000] font-bold">
                  R{round.roundNumber}
                </span>
                <span className="text-[#cfc6b4] text-[11px]">
                  {isPlayer1 ? round.player1Move : round.player2Move} vs{' '}
                  {isPlayer1 ? round.player2Move : round.player1Move}
                </span>
                <span
                  className={`font-['Chakra_Petch'] font-bold text-[10px] uppercase ${
                    (isPlayer1 && round.winner === 'PLAYER_1') ||
                    (!isPlayer1 && round.winner === 'PLAYER_2')
                      ? 'text-[#33ff55]'
                      : round.winner === 'DRAW'
                      ? 'text-[#ffb000]'
                      : 'text-[#ff5500]'
                  }`}
                >
                  {(isPlayer1 && round.winner === 'PLAYER_1') ||
                  (!isPlayer1 && round.winner === 'PLAYER_2')
                    ? 'WIN'
                    : round.winner === 'DRAW'
                    ? 'TIE'
                    : 'LOSS'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tactile Action Pushbuttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              playMechanicalClick();
              onPlayAgain();
            }}
            className="btn-tactile-orange py-3 px-4 rounded-xl font-['Chakra_Petch'] font-bold text-xs uppercase text-white tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw size={15} /> REWIND & REMATCH
          </button>
          <button
            onClick={() => {
              playMechanicalClick();
              onLeave();
            }}
            className="btn-tactile py-3 px-4 rounded-xl font-['Chakra_Petch'] font-bold text-xs uppercase text-[#cfc6b4] tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home size={15} /> EJECT TO LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}
