"use client"

import type React from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useState, useEffect, useRef } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Info, DollarSign, RotateCcw, Settings } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"

const GRID_ROWS = 8
const CELL_WIDTH = 120
const CELL_HEIGHT = 80
const FIXED_DT = 50 // Fixed simulation timestep in ms
const Y_AXIS_PADDING = 60 // Left side padding for Y-axis values
const X_AXIS_PADDING = 30 // Top padding for time labels

const markets = [
  { id: "1", name: "Live Game Total Points", baseValue: 47.5, variance: 8, step: 0.5 },
  { id: "2", name: "Live Spread", baseValue: -3.5, variance: 5, step: 0.5 },
  { id: "3", name: "Team Total Points", baseValue: 24.5, variance: 6, step: 0.5 },
  { id: "4", name: "Quarter / Half Total Points", baseValue: 14.5, variance: 4, step: 0.5 },
]

const games = [
  {
    id: "1",
    name: "Chiefs vs Bills",
    teams: { 
      home: { name: "Chiefs", logo: "🏈", color: "text-red-400" },
      away: { name: "Bills", logo: "🏈", color: "text-blue-400" }
    },
    quarter: "Q2",
    time: "8:45",
    bgColor: "from-red-900/20 via-red-950/30 to-blue-900/20",
    startProgress: 0.25,
    initialScore: { home: 14, away: 10 }
  },
  {
    id: "2",
    name: "Bengals vs Ravens",
    teams: { 
      home: { name: "Bengals", logo: "🐅", color: "text-orange-400" },
      away: { name: "Ravens", logo: "🦅", color: "text-purple-400" }
    },
    quarter: "Q3",
    time: "12:30",
    bgColor: "from-orange-900/20 via-orange-950/30 to-purple-900/20",
    startProgress: 0.35,
    initialScore: { home: 21, away: 17 }
  },
  {
    id: "3",
    name: "49ers vs Cowboys",
    teams: { 
      home: { name: "49ers", logo: "⭐", color: "text-yellow-400" },
      away: { name: "Cowboys", logo: "🤠", color: "text-blue-400" }
    },
    quarter: "Q1",
    time: "5:22",
    bgColor: "from-yellow-900/20 via-yellow-950/30 to-blue-900/20",
    startProgress: 0.45,
    initialScore: { home: 7, away: 3 }
  },
  {
    id: "4",
    name: "Eagles vs Packers",
    teams: { 
      home: { name: "Eagles", logo: "🦅", color: "text-green-400" },
      away: { name: "Packers", logo: "🧀", color: "text-emerald-400" }
    },
    quarter: "Q4",
    time: "3:15",
    bgColor: "from-green-900/20 via-green-950/30 to-emerald-900/20",
    startProgress: 0.3,
    initialScore: { home: 28, away: 24 }
  },
  {
    id: "5",
    name: "Rams vs Seahawks",
    teams: { 
      home: { name: "Rams", logo: "🐏", color: "text-blue-400" },
      away: { name: "Seahawks", logo: "🦅", color: "text-green-400" }
    },
    quarter: "Q2",
    time: "10:00",
    bgColor: "from-blue-900/20 via-blue-950/30 to-green-900/20",
    startProgress: 0.4,
    initialScore: { home: 10, away: 13 }
  },
  {
    id: "6",
    name: "Patriots vs Dolphins",
    teams: { 
      home: { name: "Patriots", logo: "⭐", color: "text-indigo-400" },
      away: { name: "Dolphins", logo: "🐬", color: "text-cyan-400" }
    },
    quarter: "Q3",
    time: "7:45",
    bgColor: "from-indigo-900/20 via-indigo-950/30 to-cyan-900/20",
    startProgress: 0.28,
    initialScore: { home: 17, away: 20 }
  },
]

interface LinePoint {
  timestamp: number // ms since game start
  value: number // market value
}

interface Bet {
  cellKey: string
  row: number
  col: number
  amount: number
  targetValue: number
  multiplier: number
  timestamp: number
}

interface WinAnimation {
  id: string
  x: number
  y: number
  amount: number
}

interface ExplosionParticle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export default function TapPredict() {
  const [simulationTime, setSimulationTime] = useState(60) // Total game duration in seconds
  const [lineSpeed, setLineSpeed] = useState(15) // pixels per second horizontal movement (10-30)
  const [verticalChangeFrequency, setVerticalChangeFrequency] = useState(5) // seconds between major vertical changes (3-15)
  const [selectedMarket, setSelectedMarket] = useState("1")
  const [stake, setStake] = useState("10")
  const [selectedGame, setSelectedGame] = useState("1")
  const [balance, setBalance] = useState(1000)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState("") // Added player selection
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [gameScores, setGameScores] = useState<Map<string, { home: number; away: number }>>(
    new Map(games.map(game => [game.id, game.initialScore]))
  )
  const isMobile = useIsMobile()

  const [lineHistory, setLineHistory] = useState<LinePoint[]>([])
  const [currentTime, setCurrentTime] = useState(0) // ms elapsed in simulation

  const [bets, setBets] = useState<Map<string, Bet>>(new Map())
  const [particles, setParticles] = useState<Array<{ id: string; x: number; y: number }>>([])
  const [winAnimations, setWinAnimations] = useState<WinAnimation[]>([])
  const [multiplierChanges, setMultiplierChanges] = useState<Set<string>>(new Set())
  const [explosionParticles, setExplosionParticles] = useState<ExplosionParticle[]>([])

  const trendRef = useRef({
    direction: 1,
    momentum: 0,
    trendStrength: 0.5,
    volatility: 0.3,
    targetValue: 0,
    timeSinceLastChange: 0,
    currentZone: 0.5, // 0-1 representing position within constrained range
    zoneCommitment: 0, // time committed to staying in this zone
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number>()
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isDragging = useRef(false)
  const dragStartScrollLeft = useRef(0)
  const dragStartScrollTop = useRef(0)
  const lastManualScrollTime = useRef(0)
  const eventsListRef = useRef<HTMLDivElement>(null)
  const eventsDragStartX = useRef(0)
  const eventsDragStartScrollLeft = useRef(0)
  const isEventsDragging = useRef(false)
  const didEventsDrag = useRef(false)

  const lastRenderTimeRef = useRef(Date.now())
  const accumulator = useRef(0)
  const gridCacheRef = useRef<HTMLCanvasElement | null>(null)
  const processedBetsRef = useRef<Set<string>>(new Set())

  const currentMarket = markets.find((m) => m.id === selectedMarket) || markets[0]
  const currentGame = games.find((g) => g.id === selectedGame) || games[0]

  useEffect(() => {
    const startTime = simulationTime * 1000 * currentGame.startProgress
    const initialValue = currentMarket.baseValue
    setLineHistory([{ timestamp: 0, value: initialValue }])
    setCurrentTime(startTime)
    trendRef.current.targetValue = initialValue
    trendRef.current.timeSinceLastChange = 0
    trendRef.current.currentZone = 0.5
    trendRef.current.zoneCommitment = 0
    processedBetsRef.current.clear()
  }, [selectedMarket, selectedGame])

  const handleReset = () => {
    const initialValue = currentMarket.baseValue
    setLineHistory([{ timestamp: 0, value: initialValue }])
    setCurrentTime(0)
    setBets(new Map())
    setWinAnimations([])
    setExplosionParticles([])
    lastRenderTimeRef.current = Date.now()
    accumulator.current = 0
    trendRef.current = {
      direction: 1,
      momentum: 0,
      trendStrength: 0.5,
      volatility: 0.3,
      targetValue: initialValue,
      timeSinceLastChange: 0,
      currentZone: 0.5,
      zoneCommitment: 0,
    }
    processedBetsRef.current.clear()
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Check if it's the first time visiting
      const hasVisited = localStorage.getItem("hasVisitedBefore")
      if (!hasVisited) {
        setShowWelcomeModal(true)
        localStorage.setItem("hasVisitedBefore", "true")
      }
    }
  }, [])

  // Update game scores periodically to simulate live games
  useEffect(() => {
    const updateScores = () => {
      setGameScores(prev => {
        const newScores = new Map(prev)
        games.forEach(game => {
          const currentScore = newScores.get(game.id) || game.initialScore
          // Randomly update scores (20% chance per update)
          if (Math.random() < 0.2) {
            const scoreHome = Math.random() < 0.5
            newScores.set(game.id, {
              home: scoreHome ? currentScore.home + (Math.random() < 0.7 ? 7 : 3) : currentScore.home,
              away: !scoreHome ? currentScore.away + (Math.random() < 0.7 ? 7 : 3) : currentScore.away
            })
          }
        })
        return newScores
      })
    }

    const interval = setInterval(updateScores, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const totalSimulationMs = simulationTime * 1000

    const gameLoop = () => {
      const now = Date.now()
      const frameTime = Math.min(now - lastRenderTimeRef.current, 100) // Cap at 100ms to prevent spiral of death
      lastRenderTimeRef.current = now

      accumulator.current += frameTime

      // Fixed timestep simulation
      while (accumulator.current >= FIXED_DT) {
        stepSimulation(FIXED_DT)
        accumulator.current -= FIXED_DT
      }

      // Continue if not finished
      if (currentTime < totalSimulationMs) {
        animationFrameRef.current = requestAnimationFrame(gameLoop)
      }
    }

    animationFrameRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [simulationTime, currentTime])

  const stepSimulation = (dt: number) => {
    setCurrentTime((prev) => {
      const newTime = prev + dt
      const totalSimulationMs = simulationTime * 1000

      if (newTime >= totalSimulationMs) {
        return totalSimulationMs
      }

      setLineHistory((prevHistory) => {
        const lastPoint = prevHistory[prevHistory.length - 1]
        const lastValue = lastPoint?.value || currentMarket.baseValue
        const trend = trendRef.current

        const minValue = currentMarket.baseValue - currentMarket.variance
        const maxValue = currentMarket.baseValue + currentMarket.variance
        const totalRange = maxValue - minValue

        const constrainedRange = totalRange * 0.65
        const constrainedMin = currentMarket.baseValue - constrainedRange / 2
        const constrainedMax = currentMarket.baseValue + constrainedRange / 2

        trend.timeSinceLastChange += dt / 1000
        trend.zoneCommitment += dt / 1000

        const zoneChangeInterval = verticalChangeFrequency * (2 + Math.random())
        if (trend.zoneCommitment >= zoneChangeInterval) {
          trend.currentZone = Math.random()
          trend.zoneCommitment = 0
          trend.momentum = 0
          trend.volatility = 0.15 + Math.random() * 0.25

          trend.targetValue = constrainedMin + trend.currentZone * constrainedRange
        }

        const zoneRange = constrainedRange * 0.15
        const zoneMin = Math.max(constrainedMin, trend.targetValue - zoneRange / 2)
        const zoneMax = Math.min(constrainedMax, trend.targetValue + zoneRange / 2)

        if (trend.timeSinceLastChange >= verticalChangeFrequency * 0.3) {
          trend.direction = Math.random() > 0.5 ? 1 : -1
          trend.timeSinceLastChange = 0
        }

        trend.momentum = Math.min(0.6, trend.momentum + 0.015)

        const isBreakout = Math.random() < 0.002
        if (isBreakout) {
          trend.currentZone = Math.random()
          trend.targetValue = constrainedMin + trend.currentZone * constrainedRange
          trend.zoneCommitment = 0
        }

        const trendMove = trend.direction * trend.trendStrength * trend.momentum
        const noise = (Math.random() - 0.5) * trend.volatility * 2
        let change = (trendMove + noise) * currentMarket.step * 6

        if (Math.random() < 0.05) {
          change *= 0.1
        }

        const newValue = Math.max(zoneMin, Math.min(zoneMax, lastValue + change))

        if (newValue <= zoneMin || newValue >= zoneMax) {
          trend.direction *= -1
          trend.momentum *= 0.3
        }

        checkWinningBets(lastValue, newValue, newTime)

        const newPoint: LinePoint = {
          timestamp: newTime,
          value: newValue,
        }

        return [...prevHistory, newPoint]
      })

      const container = containerRef.current
      if (container && lineHistory.length > 0 && !isDragging.current) {
        // Only auto-scroll if user hasn't manually scrolled in the last 3 seconds
        const timeSinceManualScroll = Date.now() - lastManualScrollTime.current
        if (timeSinceManualScroll > 3000) {
          const xPosition = timeToX(newTime)
          // Keep the line at 25% from the left, ensuring 75% of screen shows future blocks with multipliers
          const targetScroll = Math.max(0, xPosition - container.clientWidth * 0.25)
          container.scrollTo({ left: targetScroll, behavior: "auto" })
        }
      }

      return newTime
    })
  }

  const timeToX = (timestamp: number): number => {
    return (timestamp / 1000) * lineSpeed
  }

  const xToTime = (x: number): number => {
    return (x / lineSpeed) * 1000
  }

  const checkWinningBets = (prevValue: number, currentValue: number, timestamp: number) => {
    bets.forEach((bet, cellKey) => {
      if (processedBetsRef.current.has(cellKey)) return

      // Check if current time has passed the bet's cell time position
      const cellStartTime = bet.col * CELL_WIDTH / lineSpeed * 1000
      const cellEndTime = (bet.col + 1) * CELL_WIDTH / lineSpeed * 1000
      
      // Only check for wins if we're within or past the cell's time range
      if (timestamp < cellStartTime) return

      const cellTopValue = getGridValue(bet.row)
      const cellBottomValue = getGridValue(bet.row + 1) || cellTopValue - (currentMarket.variance * 2) / GRID_ROWS

      const cellMin = Math.min(cellTopValue, cellBottomValue)
      const cellMax = Math.max(cellTopValue, cellBottomValue)

      const lineMin = Math.min(prevValue, currentValue)
      const lineMax = Math.max(prevValue, currentValue)

      // Check if the line's value range intersects with the cell's value range
      const intersects = lineMax >= cellMin && lineMin <= cellMax

      if (intersects && timestamp >= cellStartTime && timestamp <= cellEndTime) {
        const winAmount = bet.amount * bet.multiplier
        setBalance((prev) => prev + winAmount)

        const canvas = canvasRef.current
        if (canvas) {
          const rect = canvas.getBoundingClientRect()
          const winX = rect.left + timeToX(timestamp) - (containerRef.current?.scrollLeft || 0)
          const winY = rect.top + getRowForValue(bet.targetValue) * CELL_HEIGHT + CELL_HEIGHT / 2 + X_AXIS_PADDING

          setWinAnimations((prev) => [
            ...prev,
            {
              id: `win-${Date.now()}-${cellKey}`,
              x: winX,
              y: winY,
              amount: winAmount,
            },
          ])

          createExplosion(winX, winY)
        }

        processedBetsRef.current.add(cellKey)

        setBets((prev) => {
          const newBets = new Map(prev)
          newBets.delete(cellKey)
          return newBets
        })

        playWinSound()
      }
    })
  }

  const createExplosion = (x: number, y: number) => {
    const particles: ExplosionParticle[] = []
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30
      const velocity = 3 + Math.random() * 4
      particles.push({
        id: `explosion-${Date.now()}-${i}`,
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: 1.0,
      })
    }
    setExplosionParticles((prev) => [...prev, ...particles])
  }

  useEffect(() => {
    if (explosionParticles.length === 0) return

    const animateExplosion = () => {
      setExplosionParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2,
            life: p.life - 0.02,
          }))
          .filter((p) => p.life > 0),
      )
    }

    const interval = setInterval(animateExplosion, 16)
    return () => clearInterval(interval)
  }, [explosionParticles.length > 0])

  const getGridValue = (row: number) => {
    const minValue = currentMarket.baseValue - currentMarket.variance
    const maxValue = currentMarket.baseValue + currentMarket.variance
    return maxValue - (row / (GRID_ROWS - 1)) * (maxValue - minValue)
  }

  const getRowForValue = (value: number) => {
    const minValue = currentMarket.baseValue - currentMarket.variance
    const maxValue = currentMarket.baseValue + currentMarket.variance
    const normalized = (maxValue - value) / (maxValue - minValue)
    return normalized * (GRID_ROWS - 1)
  }

  const getMultiplier = (targetValue: number, currentValue: number) => {
    const distance = Math.abs(targetValue - currentValue)
    const multiplier = 1 + (distance / currentMarket.variance) * 2.5
    return Math.min(multiplier, 5)
  }

  const playTapSound = () => {
    if (audioContextRef.current) {
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.frequency.value = 1200
      oscillator.type = "sine"

      gainNode.gain.setValueAtTime(0.4, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.15)

      oscillator.start(audioContextRef.current.currentTime)
      oscillator.stop(audioContextRef.current.currentTime + 0.15)
    }
  }

  const playWinSound = () => {
    if (audioContextRef.current) {
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)
      oscillator.type = "sine"

      gainNode.gain.setValueAtTime(0.5, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    }
  }

  const createParticles = (x: number, y: number) => {
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      x,
      y,
    }))
    setParticles((prev) => [...prev, ...newParticles])
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)))
    }, 800)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const totalSimulationMs = simulationTime * 1000
    const canvasWidth =
      Math.max(containerRef.current?.clientWidth || 0, Math.ceil((totalSimulationMs / 1000) * lineSpeed)) +
      Y_AXIS_PADDING
    const canvasHeight = GRID_ROWS * CELL_HEIGHT + X_AXIS_PADDING

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    if (!gridCacheRef.current || gridCacheRef.current.width !== canvasWidth) {
      gridCacheRef.current = document.createElement("canvas")
      gridCacheRef.current.width = canvasWidth
      gridCacheRef.current.height = canvasHeight

      const cacheCtx = gridCacheRef.current.getContext("2d")
      if (cacheCtx) {
        const numColumns = Math.ceil((canvasWidth - Y_AXIS_PADDING) / CELL_WIDTH) + 1

        // Don't draw Y-axis labels in cache - they'll be drawn as sticky overlay
        
        cacheCtx.fillStyle = "rgba(255, 255, 255, 0.15)"
        cacheCtx.lineWidth = 1.5

        for (let row = 0; row < GRID_ROWS; row++) {
          for (let col = 0; col < numColumns; col++) {
            const x = col * CELL_WIDTH + Y_AXIS_PADDING
            const y = row * CELL_HEIGHT + X_AXIS_PADDING

            cacheCtx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT)

            const dotRadius = 1.5
            cacheCtx.fillStyle = "rgba(255, 255, 255, 0.25)"
            cacheCtx.beginPath()
            cacheCtx.arc(x + 4, y + 4, dotRadius, 0, Math.PI * 2)
            cacheCtx.fill()
            cacheCtx.beginPath()
            cacheCtx.arc(x + CELL_WIDTH - 4, y + 4, dotRadius, 0, Math.PI * 2)
            cacheCtx.fill()
            cacheCtx.beginPath()
            cacheCtx.arc(x + 4, y + CELL_HEIGHT - 4, dotRadius, 0, Math.PI * 2)
            cacheCtx.fill()
            cacheCtx.beginPath()
            cacheCtx.arc(x + CELL_WIDTH - 4, y + CELL_HEIGHT - 4, dotRadius, 0, Math.PI * 2)
            cacheCtx.fill()
          }
        }

        cacheCtx.fillStyle = "rgba(255, 255, 255, 0.7)"
        cacheCtx.font = "bold 11px monospace"
        cacheCtx.textAlign = "center"
        cacheCtx.textBaseline = "middle"

        const timeInterval = 30
        const numTimeLabels = Math.ceil(totalSimulationMs / 1000 / timeInterval)
        for (let i = 0; i <= numTimeLabels; i++) {
          const seconds = i * timeInterval
          const x = seconds * lineSpeed + Y_AXIS_PADDING
          cacheCtx.fillText(`${seconds}s`, x, X_AXIS_PADDING / 2)
        }
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (gridCacheRef.current) {
        ctx.drawImage(gridCacheRef.current, 0, 0)
      }

      const currentLine = lineHistory[lineHistory.length - 1]
      const currentValue = currentLine?.value || currentMarket.baseValue
      const currentX = currentLine ? timeToX(currentLine.timestamp) + Y_AXIS_PADDING : Y_AXIS_PADDING

      const numColumns = Math.ceil((canvas.width - Y_AXIS_PADDING) / CELL_WIDTH)
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < numColumns; col++) {
          const x = col * CELL_WIDTH + Y_AXIS_PADDING
          const y = row * CELL_HEIGHT + X_AXIS_PADDING
          const cellKey = `${row}-${col}`
          const targetValue = getGridValue(row)
          const multiplier = getMultiplier(targetValue, currentValue)
          const bet = bets.get(cellKey)
          const isPast = x < currentX

          if (bet) {
            ctx.fillStyle = "rgba(234, 179, 8, 0.3)"
            ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT)

            ctx.strokeStyle = "rgba(234, 179, 8, 0.9)"
            ctx.lineWidth = 3
            ctx.strokeRect(x + 2, y + 2, CELL_WIDTH - 4, CELL_HEIGHT - 4)

            ctx.fillStyle = "rgba(255, 255, 255, 0.95)"
            ctx.font = "bold 18px monospace"
            ctx.textAlign = "center"
            ctx.fillText(`$${bet.amount}`, x + CELL_WIDTH / 2, y + CELL_HEIGHT / 2 - 5)

            ctx.shadowBlur = 20
            ctx.shadowColor = "rgba(234, 179, 8, 0.8)"
            ctx.strokeRect(x + 2, y + 2, CELL_WIDTH - 4, CELL_HEIGHT - 4)
            ctx.shadowBlur = 0

            ctx.fillStyle = "rgba(255, 255, 255, 0.95)"
            ctx.font = "bold 16px monospace"
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillText(`${bet.multiplier.toFixed(2)}x`, x + CELL_WIDTH / 2, y + CELL_HEIGHT / 2 + 15)
          }

          if (!isPast && !bet) {
            const isChanging = multiplierChanges.has(cellKey)
            ctx.fillStyle = isChanging ? "rgba(234, 179, 8, 0.95)" : "rgba(255, 255, 255, 0.45)"
            ctx.font = "bold 14px monospace"
            ctx.textAlign = "right"
            ctx.textBaseline = "bottom"
            ctx.fillText(`${multiplier.toFixed(2)}x`, x + CELL_WIDTH - 6, y + CELL_HEIGHT - 6)
          }
        }
      }

      if (lineHistory.length > 1) {
        ctx.beginPath()
        ctx.lineWidth = 4
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        const points = lineHistory.map((point) => ({
          x: timeToX(point.timestamp) + Y_AXIS_PADDING,
          y: getRowForValue(point.value) * CELL_HEIGHT + CELL_HEIGHT / 2 + X_AXIS_PADDING,
        }))

        ctx.moveTo(points[0].x, points[0].y)

        for (let i = 0; i < points.length - 1; i++) {
          const current = points[i]
          const next = points[i + 1]

          if (i === points.length - 2) {
            ctx.lineTo(next.x, next.y)
          } else {
            const nextNext = points[i + 2]
            const cpX = (current.x + next.x) / 2
            const cpY = (current.y + next.y) / 2
            ctx.quadraticCurveTo(current.x, current.y, cpX, cpY)
          }

          const progress = i / (points.length - 1)
          const gradient = ctx.createLinearGradient(points[0].x, 0, points[points.length - 1].x, 0)
          gradient.addColorStop(0, "rgba(16, 185, 129, 0.5)")
          gradient.addColorStop(1, "rgba(16, 185, 129, 1)")
          ctx.strokeStyle = gradient
        }

        ctx.stroke()

        const lastPoint = points[points.length - 1]
        ctx.beginPath()
        ctx.arc(lastPoint.x, lastPoint.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255, 255, 255, 1)"
        ctx.fill()

        ctx.beginPath()
        ctx.arc(lastPoint.x, lastPoint.y, 12, 0, Math.PI * 2)
        ctx.strokeStyle = "rgba(16, 185, 129, 0.8)"
        ctx.lineWidth = 3
        ctx.stroke()

        ctx.shadowBlur = 20
        ctx.shadowColor = "rgba(16, 185, 129, 0.8)"
        ctx.beginPath()
        ctx.arc(lastPoint.x, lastPoint.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255, 255, 255, 1)"
        ctx.fill()
        ctx.shadowBlur = 0
      }
      
      // Draw sticky Y-axis labels with background
      const scrollLeft = containerRef.current?.scrollLeft || 0
      ctx.save()
      
      // Draw background for Y-axis labels
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
      ctx.fillRect(scrollLeft, 0, Y_AXIS_PADDING, canvas.height)
      
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
      ctx.font = "bold 13px monospace"
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      
      for (let row = 0; row < GRID_ROWS; row++) {
        const value = getGridValue(row)
        const y = row * CELL_HEIGHT + X_AXIS_PADDING + CELL_HEIGHT / 2
        ctx.fillText(value.toFixed(1), scrollLeft + Y_AXIS_PADDING - 10, y)
      }
      
      ctx.restore()
    }

    draw()
  }, [lineHistory, bets, currentMarket, multiplierChanges, simulationTime, lineSpeed])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scrollLeft = containerRef.current?.scrollLeft || 0
    const x = e.clientX - rect.left + scrollLeft
    const y = e.clientY - rect.top

    const adjustedX = x - Y_AXIS_PADDING
    const adjustedY = y - X_AXIS_PADDING

    if (adjustedX < 0 || adjustedY < 0) return

    const col = Math.floor(adjustedX / CELL_WIDTH)
    const row = Math.floor(adjustedY / CELL_HEIGHT)

    if (row < 0 || row >= GRID_ROWS) return

    const clickTimestamp = xToTime(adjustedX)
    if (clickTimestamp < currentTime) return

    // Check if the block is past the current line (no multiplier shown)
    const currentLine = lineHistory[lineHistory.length - 1]
    const currentX = currentLine ? timeToX(currentLine.timestamp) + Y_AXIS_PADDING : Y_AXIS_PADDING
    const blockX = col * CELL_WIDTH + Y_AXIS_PADDING
    
    // Prevent selection if block is in the past (left of current line)
    if (blockX < currentX) return

    const cellKey = `${row}-${col}`
    const targetValue = getGridValue(row)
    const stakeAmount = Number.parseFloat(stake) || 0

    if (stakeAmount <= 0 || stakeAmount > balance) return

    const currentValue = currentLine?.value || currentMarket.baseValue
    const multiplier = getMultiplier(targetValue, currentValue)

    if (bets.has(cellKey)) {
      setBets((prev) => {
        const newBets = new Map(prev)
        const bet = newBets.get(cellKey)
        if (bet) setBalance((b) => b + bet.amount)
        newBets.delete(cellKey)
        return newBets
      })
    } else {
      setBalance((prev) => prev - stakeAmount)

      setBets((prev) => {
        const newBets = new Map(prev)
        newBets.set(cellKey, {
          cellKey,
          row,
          col,
          amount: stakeAmount,
          targetValue,
          multiplier,
          timestamp: clickTimestamp,
        })
        return newBets
      })

      playTapSound()
      createParticles(e.clientX, e.clientY)

      if ("vibrate" in navigator) {
        navigator.vibrate(50)
      }
    }
  }

  const handlePlayerSelect = (playerId: string) => {
    setSelectedPlayer(playerId)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true
    touchStartX.current = e.clientX
    touchStartY.current = e.clientY
    dragStartScrollLeft.current = containerRef.current?.scrollLeft || 0
    dragStartScrollTop.current = containerRef.current?.scrollTop || 0
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return
    e.preventDefault()
    
    const deltaX = touchStartX.current - e.clientX
    const deltaY = touchStartY.current - e.clientY
    
    if (containerRef.current) {
      containerRef.current.scrollLeft = dragStartScrollLeft.current + deltaX
      containerRef.current.scrollTop = dragStartScrollTop.current + deltaY
    }
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDragging = isDragging.current
    isDragging.current = false
    
    // Only trigger click if there was no significant drag
    const deltaX = Math.abs(touchStartX.current - e.clientX)
    const deltaY = Math.abs(touchStartY.current - e.clientY)
    
    if (!wasDragging || (deltaX < 5 && deltaY < 5)) {
      handleCanvasClick(e)
    } else {
      // User manually scrolled, disable auto-scroll for 3 seconds
      lastManualScrollTime.current = Date.now()
    }
  }

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      dragStartScrollLeft.current = containerRef.current?.scrollLeft || 0
      dragStartScrollTop.current = containerRef.current?.scrollTop || 0
    }
  }

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || e.touches.length !== 1) return
    e.preventDefault()
    
    const deltaX = touchStartX.current - e.touches[0].clientX
    const deltaY = touchStartY.current - e.touches[0].clientY
    
    if (containerRef.current) {
      containerRef.current.scrollLeft = dragStartScrollLeft.current + deltaX
      containerRef.current.scrollTop = dragStartScrollTop.current + deltaY
    }
  }

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDragging.current) {
      // User manually scrolled, disable auto-scroll for 3 seconds
      lastManualScrollTime.current = Date.now()
    }
    isDragging.current = false
  }

  const handleEventsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    isEventsDragging.current = true
    didEventsDrag.current = false
    eventsDragStartX.current = e.clientX
    eventsDragStartScrollLeft.current = eventsListRef.current?.scrollLeft || 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleEventsPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEventsDragging.current) return
    const deltaX = eventsDragStartX.current - e.clientX
    if (Math.abs(deltaX) > 5) {
      didEventsDrag.current = true
    }
    if (eventsListRef.current) {
      eventsListRef.current.scrollLeft = eventsDragStartScrollLeft.current + deltaX
    }
  }

  const handleEventsPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEventsDragging.current) return
    isEventsDragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    // Reset after click handlers run
    setTimeout(() => {
      didEventsDrag.current = false
    }, 0)
  }

  const handleEventsPointerLeave = () => {
    isEventsDragging.current = false
    setTimeout(() => {
      didEventsDrag.current = false
    }, 0)
  }

  return (
    <div className={`relative flex min-h-screen flex-col bg-gradient-to-br ${currentGame.bgColor}`}>
      <div className="sticky top-0 z-10" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 60%, rgba(0,0,0,0.7) 85%, transparent 100%)',
        borderBottom: 'none'
      }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">NFL Live</h1>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              <span className="text-lg font-bold text-white">{balance.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMobile && (
              <Drawer open={showSettingsDrawer} onOpenChange={setShowSettingsDrawer}>
                <DrawerTrigger asChild>
                  <button className="rounded-lg bg-white/10 p-2 backdrop-blur-sm transition hover:bg-white/20">
                    <Settings className="h-5 w-5 text-white" />
                  </button>
                </DrawerTrigger>
                <DrawerContent className="bg-black/95 border-white/20 backdrop-blur-xl">
                  <DrawerHeader>
                    <DrawerTitle className="text-white">Settings</DrawerTitle>
                  </DrawerHeader>
                  <div className="space-y-4 px-4 pb-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-white/70">Advanced Configuration</h3>
                      <div>
                        <label className="mb-1 flex items-center justify-between text-xs font-medium text-white/70">
                          <span>Line Speed</span>
                          <span className="text-emerald-400">{lineSpeed} px/s</span>
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="30"
                          step="1"
                          value={lineSpeed}
                          onChange={(e) => setLineSpeed(Number(e.target.value))}
                          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 flex items-center justify-between text-xs font-medium text-white/70">
                          <span>Vertical Change Frequency</span>
                          <span className="text-emerald-400">Every {verticalChangeFrequency}s</span>
                        </label>
                        <input
                          type="range"
                          min="3"
                          max="15"
                          step="1"
                          value={verticalChangeFrequency}
                          onChange={(e) => setVerticalChangeFrequency(Number(e.target.value))}
                          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                        />
                      </div>

                      <div>
                        <label className="mb-1 flex items-center justify-between text-xs font-medium text-white/70">
                          <span>Simulation Time</span>
                          <span className="text-emerald-400">{simulationTime} min</span>
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="30"
                          value={simulationTime}
                          onChange={(e) => setSimulationTime(Number(e.target.value))}
                          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        handleReset()
                        setShowSettingsDrawer(false)
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset Simulation
                    </button>
                  </div>
                </DrawerContent>
              </Drawer>
            )}
            <button
              onClick={() => setShowInfoModal(true)}
              className="rounded-lg bg-white/10 p-2 backdrop-blur-sm transition hover:bg-white/20"
            >
              <Info className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        <div
          ref={eventsListRef}
          className="overflow-x-auto px-4 py-2 touch-pan-x cursor-grab active:cursor-grabbing select-none"
          style={{ WebkitOverflowScrolling: "touch" }}
          onPointerDown={handleEventsPointerDown}
          onPointerMove={handleEventsPointerMove}
          onPointerUp={handleEventsPointerUp}
          onPointerCancel={handleEventsPointerLeave}
          onPointerLeave={handleEventsPointerLeave}
        >
          <div className="flex min-w-max gap-3">
            {games.map((game) => {
              const scores = gameScores.get(game.id) || game.initialScore
              const totalScore = scores.home + scores.away
              return (
                <button
                  key={game.id}
                  onClick={() => {
                    if (didEventsDrag.current) return
                    setSelectedGame(game.id)
                  }}
                  className={`relative flex-shrink-0 rounded-lg border-2 px-3 py-2.5 transition min-w-[140px] ${
                    selectedGame === game.id
                      ? "border-emerald-500 bg-emerald-500/20"
                      : "border-white/20 bg-white/5 hover:border-white/40"
                  }`}
                >
                  {/* Teams and Scores */}
                  <div className="space-y-1 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{game.teams.home.logo}</span>
                        <span className={`text-xs font-semibold ${game.teams.home.color}`}>
                          {game.teams.home.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">{scores.home}</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{game.teams.away.logo}</span>
                        <span className={`text-xs font-semibold ${game.teams.away.color}`}>
                          {game.teams.away.name}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">{scores.away}</span>
                    </div>
                  </div>

                  {/* Quarter, Time, and IN PLAY dot */}
                  <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></span>
                      <span className="text-[11px] font-medium text-emerald-400">{game.quarter} {game.time}</span>
                    </div>
                    <span className="text-[10px] font-medium text-white/50">Total: {totalScore}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {!isMobile && (
          <div className="space-y-3 px-4 py-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-white/70">Market</label>
                <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                  <SelectTrigger className="border-white/20 bg-white/10 text-white backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {markets.map((market) => (
                      <SelectItem key={market.id} value={market.id}>
                        {market.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <label className="mb-1 block text-xs font-medium text-white/70">Stake ($)</label>
                <Input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="border-white/20 bg-white/10 text-white backdrop-blur-sm"
                />
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="config" className="border-white/20">
                <AccordionTrigger className="text-sm font-medium text-white/70 hover:text-white">
                  Advanced Configuration
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div>
                    <label className="mb-1 flex items-center justify-between text-xs font-medium text-white/70">
                      <span>Line Speed (Horizontal Movement)</span>
                      <span className="text-emerald-400">{lineSpeed} px/s</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="1"
                      value={lineSpeed}
                      onChange={(e) => setLineSpeed(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center justify-between text-xs font-medium text-white/70">
                      <span>Vertical Change Frequency</span>
                      <span className="text-emerald-400">Every {verticalChangeFrequency}s</span>
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="15"
                      step="1"
                      value={verticalChangeFrequency}
                      onChange={(e) => setVerticalChangeFrequency(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 flex items-center justify-between text-xs font-medium text-white/70">
                      <span>Simulation Time</span>
                      <span className="text-emerald-400">{simulationTime} min</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={simulationTime}
                      onChange={(e) => setSimulationTime(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/20"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <button
              onClick={handleReset}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 font-medium text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Simulation
            </button>
          </div>
        )}
      </div>

      <div ref={containerRef} className="relative flex-1 overflow-auto border-t border-white/10">
        <canvas 
          ref={canvasRef} 
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => { isDragging.current = false }}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          className="cursor-grab active:cursor-grabbing touch-none" 
        />
      </div>

      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none pb-safe">
          <div className="h-40" style={{ 
            background: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 40%, rgba(0,0,0,0.7) 70%, transparent 100%)',
            pointerEvents: 'auto'
          }}>
            <div className="space-y-3 px-4 pt-8 pb-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-white/70">Market</label>
                  <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                    <SelectTrigger className="border-white/20 bg-white/10 text-white backdrop-blur-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black/95 border-white/20">
                      {markets.map((market) => (
                        <SelectItem key={market.id} value={market.id}>
                          {market.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-xs font-medium text-white/70">Stake ($)</label>
                  <Input
                    type="number"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    className="border-white/20 bg-white/10 text-white backdrop-blur-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {particles.map((particle) => (
        <div
          key={particle.id}
          className="fixed w-2 h-2 bg-emerald-400 rounded-full pointer-events-none animate-ping"
          style={{ left: particle.x, top: particle.y }}
        />
      ))}

      {winAnimations.map((win) => (
        <div
          key={win.id}
          className="fixed text-2xl font-bold text-emerald-400 pointer-events-none animate-float-up"
          style={{ left: win.x, top: win.y }}
        >
          +${win.amount.toFixed(2)}
        </div>
      ))}

      {explosionParticles.map((particle) => (
        <div
          key={particle.id}
          className="fixed w-1.5 h-1.5 bg-yellow-400 rounded-full pointer-events-none"
          style={{
            left: particle.x,
            top: particle.y,
            opacity: particle.life,
          }}
        />
      ))}

      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="border-white/20 bg-black/90 text-white backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-emerald-400">How to Play</DialogTitle>
            <DialogDescription className="space-y-4 text-white/80">
              <p className="leading-relaxed">
                <strong className="text-emerald-400">Live Game Total Points:</strong> A live prediction experience where
                you tap a target line in real time. If the live line reaches that level during the game, you win.
              </p>
              <p className="leading-relaxed">
                Instead of betting Over/Under at a fixed line, you select a target line during live play. If the
                player's live prop line moves to or through that target, your prediction wins.
              </p>
              <p className="leading-relaxed">
                Tap any block on the canvas to place your bet. The moving emerald line represents the live game total.
                When it crosses your selected block, you win the displayed multiplier amount!
              </p>
              <p className="leading-relaxed">
                <strong>Multipliers:</strong> Blocks further from the current line have higher multipliers (up to 5x).
                Once the line passes a block, you can no longer bet on it.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className="border-emerald-500/30 bg-gradient-to-br from-black via-emerald-950/20 to-black text-white backdrop-blur-xl sm:max-w-md">
          <DialogHeader className="space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/50">
              <span className="text-4xl">🎮</span>
            </div>
            <DialogTitle className="text-center text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
              Welcome to NFL Live!
            </DialogTitle>
            <DialogDescription className="space-y-6 text-white/90">
              <div className="rounded-xl border border-emerald-500/30 bg-black/40 p-6 backdrop-blur-sm">
                <h3 className="mb-4 text-center text-lg font-semibold text-emerald-400">Your Starting Balance</h3>
                <div className="flex items-center justify-center gap-3">
                  <DollarSign className="h-8 w-8 text-emerald-400" />
                  <span className="text-4xl font-bold text-white">{balance.toFixed(2)}</span>
                </div>
                <p className="mt-3 text-center text-sm text-white/60">
                  Use this to place bets and win big!
                </p>
              </div>

              <div className="rounded-xl border border-white/20 bg-black/40 p-5 backdrop-blur-sm">
                <h4 className="mb-3 text-center text-sm font-medium text-white/70">Default Stake Per Bet</h4>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold text-emerald-400">${stake}</span>
                </div>
                <p className="mt-2 text-center text-xs text-white/50">
                  You can adjust this anytime in the controls
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <p className="text-white/80">
                    <strong className="text-white">Tap blocks</strong> on the grid to place your bets
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <p className="text-white/80">
                    <strong className="text-white">Win multipliers</strong> when the line crosses your block
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <p className="text-white/80">
                    <strong className="text-white">Higher multipliers</strong> for riskier predictions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowWelcomeModal(false)}
                className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]"
              >
                Let's Play! 🎯
              </button>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
