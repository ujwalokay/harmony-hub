import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock,
  HelpCircle,
  RotateCcw,
  Settings,
  Swords,
  Undo2,
  Users,
} from "lucide-react";
import {
  createGame,
  legalMovesFrom,
  movePiece,
  placeGoat,
  tigerAiMove,
  TOTAL_GOATS,
  type GameState,
} from "@/lib/baghchal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import valleyBgAsset from "@/assets/valley-bg.jpg.asset.json";
const arenaSkyUrl = valleyBgAsset.url;

const BoardScene = lazy(() => import("@/components/game/BoardScene"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bagh-Chal 3D — Tigers vs Goats Board Game" },
      {
        name: "description",
        content:
          "Play Bagh-Chal, the classic Nepalese tigers-and-goats strategy game, in a fully interactive 3D board rendered with Three.js.",
      },
      { property: "og:title", content: "Bagh-Chal 3D — Tigers vs Goats Board Game" },
      {
        property: "og:description",
        content: "Trap the tigers or devour the goats in this interactive 3D Bagh-Chal board game.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [selected, setSelected] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [vsAi, setVsAi] = useState(true);

  useEffect(() => setMounted(true), []);

  const placementPhase = game.goatsPlaced < TOTAL_GOATS;

  const targets = useMemo(() => {
    if (game.winner) return [];
    if (selected !== null) return legalMovesFrom(game, selected);
    if (game.turn === "goat" && placementPhase)
      return game.board.map((c, i) => (c === "empty" ? i : -1)).filter((i) => i >= 0);
    return [];
  }, [game, selected, placementPhase]);

  const onNodeClick = useCallback(
    (i: number) => {
      if (game.winner) return;
      const cell = game.board[i];

      if (selected !== null) {
        const next = movePiece(game, selected, i);
        if (next) {
          setGame(next);
          setSelected(null);
          return;
        }
      }

      if (cell === game.turn && !(game.turn === "goat" && placementPhase)) {
        setSelected(selected === i ? null : i);
        return;
      }

      if (game.turn === "goat" && placementPhase && cell === "empty") {
        const next = placeGoat(game, i);
        if (next) {
          setGame(next);
          setSelected(null);
        }
      }
    },
    [game, selected, placementPhase],
  );

  // Tiger AI
  useEffect(() => {
    if (!vsAi || game.turn !== "tiger" || game.winner) return;
    const t = setTimeout(() => {
      setGame((g) => (g.turn === "tiger" && !g.winner ? (tigerAiMove(g) ?? g) : g));
    }, 600);
    return () => clearTimeout(t);
  }, [game, vsAi]);

  const reset = () => {
    setGame(createGame());
    setSelected(null);
  };

  const status = game.winner
    ? game.winner === "tiger"
      ? "Tigers win — five goats devoured!"
      : "Goats win — every tiger is trapped!"
    : game.turn === "goat"
      ? placementPhase
        ? "Goats: place a goat on any empty node"
        : "Goats: move a goat to an adjacent node"
      : vsAi
        ? "Tigers are prowling…"
        : "Tigers: move or jump over a goat";

  const tigersLeft = game.board.filter((c) => c === "tiger").length;
  const goatsOnBoard = game.board.filter((c) => c === "goat").length;
  const turnNo = String(game.history.length + 1).padStart(2, "0");

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#bfe6ff] via-[#a7dc8b] to-[#7fb44e]">
      {/* painted landscape backdrop behind the 3D arena */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${arenaSkyUrl})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" aria-hidden />



      <div className="absolute inset-0">
        {mounted ? (
          <Suspense fallback={null}>
            <BoardScene
              board={game.board}
              selected={selected}
              targets={targets}
              onNodeClick={onNodeClick}
            />
          </Suspense>
        ) : null}
      </div>

      {/* HUD */}
      <div className="pointer-events-none relative z-10 flex min-h-screen flex-col justify-between gap-3 p-2 sm:p-5">
        <header data-hud="1" className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <IconButton label="Settings" onClick={() => setRulesOpen(true)}>
            <Settings className="size-4 sm:size-5" />
          </IconButton>

          <div className="mx-auto truncate rounded-2xl border border-black/40 bg-neutral-900/85 px-3 py-1.5 text-base font-black tracking-wide text-white shadow-2xl backdrop-blur sm:px-6 sm:py-2 sm:text-2xl">
            TURN <span className="text-amber-400">{turnNo}</span>
            <Users className="ml-2 inline size-4 -translate-y-0.5 sm:size-5" />
          </div>

          <div className="flex shrink-0 gap-1.5 sm:gap-2">
            <IconButton label="Reset" onClick={reset}>
              <Undo2 className="size-4 sm:size-5" />
            </IconButton>
            <IconButton label="Rules" onClick={() => setRulesOpen(true)}>
              <HelpCircle className="size-4 sm:size-5" />
            </IconButton>
          </div>
        </header>

        <div className="mb-auto grid grid-cols-2 items-stretch gap-2 lg:mb-0 lg:flex lg:items-center lg:justify-between lg:gap-3">
          <SidePanel
            side="tiger"
            title="TIGERS"
            value={`${tigersLeft} Tigers`}
            objective="Capture 5 Goats"
            active={game.turn === "tiger"}
          />
          <SidePanel
            side="goat"
            title="GOATS"
            value={`${goatsOnBoard} Goats`}
            objective="Survive or Trap Tigers"
            active={game.turn === "goat"}
          />
        </div>

        <footer data-hud="1" className="flex flex-col items-center gap-2 sm:gap-3">
          <p className="max-w-full truncate rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur sm:px-4 sm:text-xs">
            {status}
          </p>


          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
            <div className="pointer-events-auto grid grid-cols-2 gap-2 sm:flex">
              <ActionButton icon={<BookOpen className="size-4" />} onClick={() => setRulesOpen(true)}>
                RULES
              </ActionButton>
              <ActionButton icon={<Clock className="size-4" />} onClick={() => setHistoryOpen(true)}>
                HISTORY
              </ActionButton>
            </div>
            <div className="pointer-events-auto grid grid-cols-2 gap-2 sm:flex">
              <ActionButton icon={<RotateCcw className="size-4" />} onClick={reset}>
                RESET
              </ActionButton>
              <ActionButton
                icon={<Swords className="size-4" />}
                onClick={() => {
                  setVsAi((v) => !v);
                  reset();
                }}
              >
                {vsAi ? "NEW GAME (2P)" : "NEW GAME (AI)"}
              </ActionButton>
            </div>
          </div>
        </footer>

      </div>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to play Bagh-Chal</DialogTitle>
            <DialogDescription>An ancient Nepalese hunt game of asymmetric war.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Four tigers start in the corners. Goats have 20 pieces to place.</li>
            <li>
              Phase 1: goats place one piece per turn on any empty node. Goats cannot move yet.
            </li>
            <li>Phase 2: once all 20 goats are placed, goats move along lines to adjacent nodes.</li>
            <li>
              Tigers move along lines, or jump straight over a single adjacent goat into the empty
              node beyond it to capture that goat.
            </li>
            <li>Tigers win by capturing 5 goats. Goats win by blocking every tiger move.</li>
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move history</DialogTitle>
            <DialogDescription>{game.history.length} moves played.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-72 pr-4">
            <ol className="space-y-1 text-sm">
              {game.history.length === 0 ? (
                <li className="text-muted-foreground">No moves yet.</li>
              ) : (
                game.history.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-6 shrink-0 text-muted-foreground">{i + 1}.</span>
                    <span>{h}</span>
                  </li>
                ))
              )}
            </ol>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="pointer-events-auto shrink-0 rounded-xl border border-black/40 bg-neutral-800/85 p-2 text-white shadow-xl backdrop-blur transition hover:bg-neutral-700 sm:p-3"
    >
      {children}
    </button>
  );
}

function SidePanel({
  side,
  title,
  value,
  objective,
  active,
}: {
  side: "tiger" | "goat";
  title: string;
  value: string;
  objective: string;
  active: boolean;
}) {
  return (
    <div
      data-hud="1"
      className={`w-full min-w-0 overflow-hidden rounded-2xl border border-black/40 bg-neutral-800/85 shadow-2xl backdrop-blur transition lg:w-52 ${
        active ? "ring-2 ring-amber-300" : ""
      }`}
    >
      <div
        className={`flex min-w-0 items-center gap-1.5 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2 ${
          side === "tiger" ? "bg-orange-900/90" : "bg-blue-900/90"
        }`}
      >
        <span
          className={`size-4 shrink-0 rounded-full border-2 border-white/70 sm:size-6 ${side === "tiger" ? "bg-orange-400" : "bg-stone-100"}`}
          aria-hidden
        />
        <span className="truncate text-sm font-black tracking-wide text-white sm:text-xl">{title}</span>
      </div>
      <div className="px-2 py-1.5 text-center text-sm font-bold text-white sm:px-3 sm:py-2 sm:text-lg">{value}</div>
      <div className="mx-2 border-t border-white/20 sm:mx-3" />
      <div className="px-2 py-1.5 text-[11px] leading-tight text-white/90 sm:px-3 sm:py-2 sm:text-sm">
        <span className="font-bold">Objective:</span>
        <br />
        {objective}
      </div>
    </div>

  );
}

function ActionButton({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      className="h-9 w-full min-w-0 gap-1.5 rounded-xl border-b-4 border-neutral-400 bg-neutral-200 px-2 text-[11px] font-black tracking-wide text-neutral-900 shadow-xl hover:bg-white sm:h-10 sm:w-auto sm:gap-2 sm:px-4 sm:text-sm"
      variant="secondary"
    >
      {icon}
      {children}
    </Button>
  );
}

