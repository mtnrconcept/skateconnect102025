import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Send, Settings, Crown } from "lucide-react";

const LETTERS = ["S", "H", "R", "E", "D"];

function ShredLetters({ value }: { value: number }) {
  return (
    <div className="flex gap-3 justify-center">
      {LETTERS.map((l, i) => (
        <div
          key={l}
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 ${
            i < value
              ? "bg-orange-500 border-orange-400 text-black shadow-[0_0_12px_rgba(255,138,0,0.8)]"
              : "border-gray-600 text-gray-500"
          }`}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

function ChatBox() {
  const [messages, setMessages] = useState([
    { id: 1, from: "A", text: "Ready?", time: "10:30" },
    { id: 2, from: "B", text: "Let's go!", time: "10:31" },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { id: Date.now(), from: "A", text: input.trim(), time: new Date().toLocaleTimeString() },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-72 bg-[#0e1117] rounded-xl border border-white/10 p-3 w-full">
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[70%] p-2 rounded-lg text-sm ${
              m.from === "A" ? "bg-orange-500/20 text-orange-200 self-start" : "bg-white/10 text-white self-end"
            }`}
          >
            <span className="block text-[10px] opacity-60">{m.time}</span>
            {m.text}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écris un message…"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 bg-transparent text-white placeholder:text-gray-500 outline-none border-b border-gray-600 focus:border-orange-400 transition-colors"
        />
        <button onClick={sendMessage} className="p-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black">
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

export default function GameOfSkateLiveMock() {
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    const i = setInterval(() => setTimer((t) => (t > 0 ? Math.round((t - 0.1) * 10) / 10 : 0)), 100);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-6 font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rider A */}
        <section className="flex flex-col items-center gap-4 border border-white/10 bg-[#11151C]/90 rounded-2xl p-4">
          <div className="text-xl font-semibold">MTNR Concept</div>
          <ShredLetters value={2} />
          <div className="w-full h-48 bg-black rounded-lg mt-3 grid place-items-center text-gray-400">Vidéo Rider A</div>
          <div className="flex justify-between w-full text-xs mt-2 text-gray-400">
            <span>Latence A</span>
            <div className="flex-1 mx-2 h-2 bg-gray-700 rounded-full">
              <div className="w-3/4 h-2 bg-emerald-400 rounded-full"></div>
            </div>
            <span>Latence B−</span>
          </div>
          <ChatBox />
        </section>

        {/* Arbitre / HUD */}
        <section className="border border-white/10 bg-[#11151C]/90 rounded-2xl p-4 flex flex-col items-center">
          <h2 className="text-lg font-bold mb-2">Arbitre du jeu</h2>
          <div className="text-4xl font-extrabold text-orange-400 mb-2">{timer.toFixed(1)}</div>
          <div className="flex gap-3 mb-4">
            <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg flex items-center gap-2">
              <CheckCircle2 size={18} /> Trick accepté
            </button>
            <button className="px-4 py-2 bg-red-500 hover:bg-red-400 text-black font-medium rounded-lg flex items-center gap-2">
              <XCircle size={18} /> Trick refusé
            </button>
          </div>

          <div className="w-full mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-center">
            <Settings size={16} className="inline-block mr-2 text-orange-400" />
            <span className="text-sm text-gray-300">Règles du jeu</span>
          </div>

          <div className="mt-4 w-full">
            <h3 className="text-center text-orange-300 font-semibold mb-1">Choix de la règle</h3>
            <select className="w-full bg-[#0c0f15] border border-white/10 rounded-md p-2 text-sm text-white">
              <option>Game of Skate</option>
              <option>Best Trick</option>
              <option>Mort Subite</option>
            </select>
          </div>

          <div className="mt-4 w-full">
            <h3 className="text-center text-orange-300 font-semibold mb-1">Trick à faire</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nom du trick"
                className="flex-1 bg-[#0c0f15] border border-white/10 rounded-md p-2 text-sm text-white placeholder:text-gray-500"
              />
              <button className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 text-sm">
                Comment faire
              </button>
            </div>
          </div>
        </section>

        {/* Rider B */}
        <section className="flex flex-col items-center gap-4 border border-white/10 bg-[#11151C]/90 rounded-2xl p-4">
          <div className="text-xl font-semibold">Nyjah Huston</div>
          <ShredLetters value={3} />
          <div className="w-full h-48 bg-black rounded-lg mt-3 grid place-items-center text-gray-400">Vidéo Rider B</div>
          <div className="flex justify-between w-full text-xs mt-2 text-gray-400">
            <span>Latence A</span>
            <div className="flex-1 mx-2 h-2 bg-gray-700 rounded-full">
              <div className="w-2/3 h-2 bg-emerald-400 rounded-full"></div>
            </div>
            <span>Latence B−</span>
          </div>
          <div className="mt-4 text-xs text-gray-300 text-center leading-relaxed">
            Deux riders s’affrontent : le premier impose une figure, l’autre doit la reproduire.
            Chaque échec donne une lettre du mot <b className="text-orange-400">S.H.R.E.D</b>. Le dernier sans toutes les lettres gagne.
          </div>
          <button className="mt-auto px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold flex items-center gap-2">
            ▶ Lancer le Stream
          </button>
        </section>
      </div>

      <div className="max-w-7xl mx-auto mt-6">
        <div className="rounded-xl border border-white/10 bg-[#11151C]/90 p-3 flex items-center justify-center gap-2 text-sm text-white/80">
          <Crown className="w-4 h-4 text-amber-300" />
          MTNR Concept vs Nyjah Huston — Exhibition Match
        </div>
      </div>
    </div>
  );
}
