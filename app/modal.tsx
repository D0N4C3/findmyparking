import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const GAME_WIDTH = 320;
const GAME_HEIGHT = 520;
const PLAYER_SIZE = 24;
const GRAVITY = 0.62;
const JUMP_FORCE = -9.6;
const BASE_OBSTACLE_SPEED = 2.2;
const SPEED_RAMP_PER_SEC = 0.07;
const BASE_SCORE_RATE = 8;
const SCORE_RAMP_PER_SEC = 0.4;
const GAP_HEIGHT = 150;
const OBSTACLE_WIDTH = 46;
const PLAYER_X = 70;
const OBSTACLE_SPACING = 210;
const MIN_GAP_Y_DELTA = 90;

type Obstacle = {
  x: number;
  gapY: number;
};

type GameState = {
  score: number;
  playerY: number;
  obstacles: Obstacle[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const createInitialObstacles = (): Obstacle[] => [
  { x: GAME_WIDTH + 40, gapY: 190 },
  { x: GAME_WIDTH + 40 + OBSTACLE_SPACING, gapY: 280 },
];

const nextGapY = (previousGapY: number) => {
  const minGapY = 80;
  const maxGapY = GAME_HEIGHT - GAP_HEIGHT - 80;
  let candidate = clamp(90 + Math.random() * 260, minGapY, maxGapY);

  if (Math.abs(candidate - previousGapY) < MIN_GAP_Y_DELTA) {
    const direction = candidate >= previousGapY ? 1 : -1;
    candidate = clamp(previousGapY + direction * MIN_GAP_Y_DELTA, minGapY, maxGapY);
  }

  return candidate;
};

export default function ModalScreen() {
  const [running, setRunning] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    playerY: GAME_HEIGHT / 2,
    obstacles: createInitialObstacles(),
  });

  const velocityRef = useRef(0);
  const elapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const previousTimestampRef = useRef(0);

  const speed = BASE_OBSTACLE_SPEED + elapsedRef.current * SPEED_RAMP_PER_SEC;
  const scoreRate = BASE_SCORE_RATE + elapsedRef.current * SCORE_RAMP_PER_SEC;

  const resetGame = () => {
    elapsedRef.current = 0;
    velocityRef.current = 0;
    previousTimestampRef.current = 0;
    setGameState({
      score: 0,
      playerY: GAME_HEIGHT / 2,
      obstacles: createInitialObstacles(),
    });
  };

  const endRun = useCallback((runScore: number) => {
    setRunning(false);
    setBestScore((prev) => Math.max(prev, Math.floor(runScore)));
  }, []);

  const checkCollision = (nextY: number, nextObstacles: Obstacle[]) => {
    if (nextY <= 0 || nextY + PLAYER_SIZE >= GAME_HEIGHT) {
      return true;
    }

    return nextObstacles.some((obstacle) => {
      const insideX =
        PLAYER_X + PLAYER_SIZE > obstacle.x && PLAYER_X < obstacle.x + OBSTACLE_WIDTH;
      if (!insideX) return false;

      const inTopPipe = nextY < obstacle.gapY;
      const inBottomPipe = nextY + PLAYER_SIZE > obstacle.gapY + GAP_HEIGHT;
      return inTopPipe || inBottomPipe;
    });
  };

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const update = (timestamp: number) => {
      if (!previousTimestampRef.current) previousTimestampRef.current = timestamp;
      const delta = Math.min((timestamp - previousTimestampRef.current) / 16.67, 2);
      previousTimestampRef.current = timestamp;

      elapsedRef.current += delta / 60;
      velocityRef.current += GRAVITY * delta;

      setGameState((currentState) => {
        const nextY = currentState.playerY + velocityRef.current * delta;
        const dynamicSpeed = BASE_OBSTACLE_SPEED + elapsedRef.current * SPEED_RAMP_PER_SEC;

        const movedObstacles = currentState.obstacles.map((obstacle) => ({
          ...obstacle,
          x: obstacle.x - dynamicSpeed * delta,
        }));

        const [first, second] = movedObstacles;
        let nextObstacles = movedObstacles;

        if (first.x + OBSTACLE_WIDTH <= 0) {
          nextObstacles = [
            {
              x: second.x + OBSTACLE_SPACING,
              gapY: nextGapY(second.gapY),
            },
            second,
          ];
        } else if (second.x + OBSTACLE_WIDTH <= 0) {
          nextObstacles = [
            first,
            {
              x: first.x + OBSTACLE_SPACING,
              gapY: nextGapY(first.gapY),
            },
          ];
        }

        if (checkCollision(nextY, nextObstacles)) {
          endRun(currentState.score);
          return currentState;
        }

        const dynamicRate = BASE_SCORE_RATE + elapsedRef.current * SCORE_RAMP_PER_SEC;
        return {
          score: currentState.score + (dynamicRate * delta) / 60,
          playerY: nextY,
          obstacles: nextObstacles,
        };
      });

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [endRun, running]);

  const handleTap = () => {
    if (!running) {
      resetGame();
      setRunning(true);
      return;
    }

    velocityRef.current = JUMP_FORCE;
  };

  return (
    <Modal animationType="fade" transparent visible onRequestClose={() => router.back()}>
      <Pressable style={styles.overlay} onPress={handleTap}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Sky Dash</Text>
          <Text style={styles.subtitle}>Tap to flap • survive as speed ramps up</Text>

          <View style={styles.hudRow}>
            <Text style={styles.hudText}>Score: {Math.floor(gameState.score)}</Text>
            <Text style={styles.hudText}>Best: {bestScore}</Text>
          </View>

          <View style={styles.gameArea}>
            {gameState.obstacles.map((obstacle, index) => (
              <View key={`pipe-${index}`}>
                <View
                  style={[
                    styles.pipe,
                    {
                      left: obstacle.x,
                      height: obstacle.gapY,
                      top: 0,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.pipe,
                    {
                      left: obstacle.x,
                      height: GAME_HEIGHT - obstacle.gapY - GAP_HEIGHT,
                      top: obstacle.gapY + GAP_HEIGHT,
                    },
                  ]}
                />
              </View>
            ))}

            <View style={[styles.player, { top: gameState.playerY, left: PLAYER_X }]} />

            {!running && (
              <View style={styles.overlayMessage}>
                <Text style={styles.overlayTitle}>Flap to start</Text>
                <Text style={styles.overlayText}>
                  Longer survival increases obstacle speed and point gain.
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.metrics}>
            Speed: {speed.toFixed(1)}x • Score Rate: {scoreRate.toFixed(1)}/s
          </Text>

          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Pressable>

      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#101521',
    borderRadius: 20,
    padding: 16,
    margin: 20,
    alignItems: 'center',
    width: GAME_WIDTH + 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f7fbff',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 10,
    color: '#9db2cc',
  },
  hudRow: {
    width: GAME_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hudText: {
    color: '#e9f3ff',
    fontWeight: '600',
  },
  gameArea: {
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1d2d43',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  pipe: {
    position: 'absolute',
    width: OBSTACLE_WIDTH,
    backgroundColor: '#52d18b',
  },
  player: {
    position: 'absolute',
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: PLAYER_SIZE / 2,
    backgroundColor: '#ffca57',
    borderWidth: 2,
    borderColor: '#fff7e6',
  },
  overlayMessage: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '40%',
    padding: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 17, 28, 0.9)',
  },
  overlayTitle: {
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  overlayText: {
    textAlign: 'center',
    color: '#9db2cc',
    lineHeight: 18,
  },
  metrics: {
    color: '#cfdef0',
    marginVertical: 10,
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 100,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
});
