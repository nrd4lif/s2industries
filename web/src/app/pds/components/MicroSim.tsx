'use client'

import { useState, useCallback, useMemo } from 'react'
import { MicroSimBlock } from '@/lib/pds/types'
import { MicroscopeIcon } from './Icons'

type Props = {
  block: MicroSimBlock
}

// Sampling Distribution Simulator
function SamplingDistributionSim() {
  const [trueRate, setTrueRate] = useState(0.5)
  const [sampleSize, setSampleSize] = useState(100)
  const [numSimulations, setNumSimulations] = useState(200)
  const [samples, setSamples] = useState<number[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const runSimulation = useCallback(() => {
    setIsRunning(true)
    setSamples([])

    // Run simulations in batches to prevent UI blocking
    const batchSize = 50
    let completed = 0
    const results: number[] = []

    const runBatch = () => {
      const remaining = numSimulations - completed
      const currentBatch = Math.min(batchSize, remaining)

      for (let i = 0; i < currentBatch; i++) {
        // Generate a sample and calculate the sample proportion
        let successes = 0
        for (let j = 0; j < sampleSize; j++) {
          if (Math.random() < trueRate) {
            successes++
          }
        }
        results.push(successes / sampleSize)
      }

      completed += currentBatch
      setSamples([...results])

      if (completed < numSimulations) {
        requestAnimationFrame(runBatch)
      } else {
        setIsRunning(false)
      }
    }

    requestAnimationFrame(runBatch)
  }, [trueRate, sampleSize, numSimulations])

  // Calculate statistics
  const stats = useMemo(() => {
    if (samples.length === 0) return null

    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance = samples.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / samples.length
    const observedSE = Math.sqrt(variance)
    const theoreticalSE = Math.sqrt((trueRate * (1 - trueRate)) / sampleSize)
    const ci95Lower = trueRate - 1.96 * theoreticalSE
    const ci95Upper = trueRate + 1.96 * theoreticalSE

    return { mean, observedSE, theoreticalSE, ci95Lower, ci95Upper }
  }, [samples, trueRate, sampleSize])

  // Build histogram data
  const histogram = useMemo(() => {
    if (samples.length === 0) return []

    const numBins = 20
    const bins: number[] = new Array(numBins).fill(0)
    const binWidth = 1 / numBins

    samples.forEach(s => {
      const binIndex = Math.min(Math.floor(s / binWidth), numBins - 1)
      bins[binIndex]++
    })

    const maxCount = Math.max(...bins)
    return bins.map((count, i) => ({
      x: (i + 0.5) * binWidth,
      count,
      height: maxCount > 0 ? (count / maxCount) * 100 : 0
    }))
  }, [samples])

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            True Rate (p): {(trueRate * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0.05"
            max="0.95"
            step="0.05"
            value={trueRate}
            onChange={(e) => setTrueRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            Sample Size (n): {sampleSize}
          </label>
          <input
            type="range"
            min="10"
            max="500"
            step="10"
            value={sampleSize}
            onChange={(e) => setSampleSize(parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            Simulations: {numSimulations}
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="50"
            value={numSimulations}
            onChange={(e) => setNumSimulations(parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      <button
        onClick={runSimulation}
        disabled={isRunning}
        className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-wait text-white text-sm font-medium transition-colors"
      >
        {isRunning ? `Running... (${samples.length}/${numSimulations})` : 'Run Simulation'}
      </button>

      {/* Histogram */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <p className="text-xs text-zinc-500 mb-3">Distribution of Sample Proportions</p>
        <div className="relative h-40">
          {histogram.length > 0 ? (
            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map(y => (
                <line
                  key={y}
                  x1="0"
                  y1={100 - y}
                  x2="100"
                  y2={100 - y}
                  stroke="#3f3f46"
                  strokeWidth="0.3"
                />
              ))}

              {/* Histogram bars */}
              {histogram.map((bin, i) => (
                <rect
                  key={i}
                  x={bin.x * 100 - 2}
                  y={100 - bin.height}
                  width={4}
                  height={bin.height}
                  fill="#3b82f6"
                  opacity="0.8"
                />
              ))}

              {/* True rate line */}
              <line
                x1={trueRate * 100}
                y1="0"
                x2={trueRate * 100}
                y2="100"
                stroke="#22c55e"
                strokeWidth="0.8"
                strokeDasharray="2,2"
              />

              {/* 95% CI lines */}
              {stats && (
                <>
                  <line
                    x1={Math.max(0, stats.ci95Lower * 100)}
                    y1="0"
                    x2={Math.max(0, stats.ci95Lower * 100)}
                    y2="100"
                    stroke="#f59e0b"
                    strokeWidth="0.5"
                    strokeDasharray="1,1"
                  />
                  <line
                    x1={Math.min(100, stats.ci95Upper * 100)}
                    y1="0"
                    x2={Math.min(100, stats.ci95Upper * 100)}
                    y2="100"
                    stroke="#f59e0b"
                    strokeWidth="0.5"
                    strokeDasharray="1,1"
                  />
                </>
              )}
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Click &quot;Run Simulation&quot; to see the distribution
            </div>
          )}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 text-xs text-zinc-600">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-green-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-zinc-400">True rate (p)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-zinc-400">95% CI bounds</span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Observed Mean</p>
            <p className="text-lg font-mono text-white">{(stats.mean * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Observed SE</p>
            <p className="text-lg font-mono text-white">{(stats.observedSE * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500">Theoretical SE</p>
            <p className="text-lg font-mono text-blue-400">{(stats.theoreticalSE * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500">95% CI Width</p>
            <p className="text-lg font-mono text-amber-400">±{(1.96 * stats.theoreticalSE * 100).toFixed(2)}%</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Confidence Interval Coverage Simulator
function ConfidenceIntervalSim() {
  const [trueRate, setTrueRate] = useState(0.5)
  const [sampleSize, setSampleSize] = useState(100)
  const [intervals, setIntervals] = useState<Array<{ lower: number; upper: number; contains: boolean }>>([])
  const [isRunning, setIsRunning] = useState(false)

  const numIntervals = 50

  const runSimulation = useCallback(() => {
    setIsRunning(true)
    setIntervals([])

    const results: Array<{ lower: number; upper: number; contains: boolean }> = []

    const runBatch = (completed: number) => {
      const batchSize = 10
      const remaining = numIntervals - completed
      const currentBatch = Math.min(batchSize, remaining)

      for (let i = 0; i < currentBatch; i++) {
        // Generate a sample
        let successes = 0
        for (let j = 0; j < sampleSize; j++) {
          if (Math.random() < trueRate) {
            successes++
          }
        }
        const pHat = successes / sampleSize
        const se = Math.sqrt((pHat * (1 - pHat)) / sampleSize)
        const lower = pHat - 1.96 * se
        const upper = pHat + 1.96 * se
        const contains = trueRate >= lower && trueRate <= upper

        results.push({ lower, upper, contains })
      }

      setIntervals([...results])

      if (completed + currentBatch < numIntervals) {
        requestAnimationFrame(() => runBatch(completed + currentBatch))
      } else {
        setIsRunning(false)
      }
    }

    requestAnimationFrame(() => runBatch(0))
  }, [trueRate, sampleSize])

  const coverage = useMemo(() => {
    if (intervals.length === 0) return null
    const containsCount = intervals.filter(i => i.contains).length
    return (containsCount / intervals.length * 100).toFixed(1)
  }, [intervals])

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            True Rate (p): {(trueRate * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={trueRate}
            onChange={(e) => setTrueRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1.5">
            Sample Size (n): {sampleSize}
          </label>
          <input
            type="range"
            min="20"
            max="300"
            step="10"
            value={sampleSize}
            onChange={(e) => setSampleSize(parseInt(e.target.value))}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>
      </div>

      <button
        onClick={runSimulation}
        disabled={isRunning}
        className="w-full py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-wait text-white text-sm font-medium transition-colors"
      >
        {isRunning ? `Generating CIs... (${intervals.length}/${numIntervals})` : 'Generate 50 Confidence Intervals'}
      </button>

      {/* CI Visualization */}
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <p className="text-xs text-zinc-500 mb-3">Each line is a 95% CI from a different sample</p>
        <div className="relative h-64 overflow-hidden">
          {intervals.length > 0 ? (
            <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
              {/* True rate vertical line */}
              <line
                x1={trueRate * 100}
                y1="0"
                x2={trueRate * 100}
                y2="100"
                stroke="#22c55e"
                strokeWidth="1"
              />

              {/* CI lines */}
              {intervals.map((interval, i) => {
                const y = (i / numIntervals) * 100 + 1
                return (
                  <line
                    key={i}
                    x1={Math.max(0, interval.lower * 100)}
                    y1={y}
                    x2={Math.min(100, interval.upper * 100)}
                    y2={y}
                    stroke={interval.contains ? '#3b82f6' : '#ef4444'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                )
              })}
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Click to generate confidence intervals
            </div>
          )}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1 text-xs text-zinc-600">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-green-500" />
            <span className="text-zinc-400">True rate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-blue-500" />
            <span className="text-zinc-400">CI contains true rate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-red-500" />
            <span className="text-zinc-400">CI misses true rate</span>
          </div>
        </div>
      </div>

      {/* Coverage stat */}
      {coverage && (
        <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
          <p className="text-xs text-zinc-500 mb-1">Observed Coverage Rate</p>
          <p className="text-3xl font-mono text-white">{coverage}%</p>
          <p className="text-xs text-zinc-500 mt-1">
            (Expected: ~95% for 95% CIs)
          </p>
        </div>
      )}
    </div>
  )
}

export default function MicroSim({ block }: Props) {
  return (
    <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center">
          <MicroscopeIcon size={16} />
        </span>
        <div>
          <p className="text-xs text-cyan-400 font-medium mb-0.5">Interactive Simulation</p>
          <p className="text-white font-medium">{block.title}</p>
          {block.description && (
            <p className="text-sm text-zinc-400 mt-1">{block.description}</p>
          )}
        </div>
      </div>

      {block.simType === 'sampling-distribution' && <SamplingDistributionSim />}
      {block.simType === 'confidence-interval' && <ConfidenceIntervalSim />}
      {block.simType === 'power-curve' && (
        <div className="text-center text-zinc-500 py-8">
          Power curve simulation coming soon
        </div>
      )}
    </div>
  )
}
