import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// Generate realistic price data with volatility
function generatePriceData(days, startPrice = 100, volatility = 0.02, trend = 0.0001) {
  const data = [];
  let price = startPrice;
  
  for (let i = 0; i < days; i++) {
    const randomShock = (Math.random() - 0.5) * 2 * volatility;
    price = price * (1 + trend + randomShock);
    data.push({
      date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      price: Number(price.toFixed(2)),
    });
  }
  return data;
}

// Moving Average Crossover Strategy
function runMovingAverageCrossover(priceData, shortWindow, longWindow, initialCapital) {
  const trades = [];
  let position = 0;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  
  const shortMA = [];
  const longMA = [];
  
  for (let i = 0; i < priceData.length; i++) {
    const shortSlice = priceData.slice(Math.max(0, i - shortWindow + 1), i + 1);
    const longSlice = priceData.slice(Math.max(0, i - longWindow + 1), i + 1);
    
    shortMA.push(shortSlice.reduce((sum, d) => sum + d.price, 0) / shortSlice.length);
    longMA.push(longSlice.reduce((sum, d) => sum + d.price, 0) / longSlice.length);
    
    if (i < longWindow) continue;
    
    const currentPrice = priceData[i].price;
    
    if (position === 0 && shortMA[i] > longMA[i] && shortMA[i - 1] <= longMA[i - 1]) {
      shares = Math.floor(cash / currentPrice);
      if (shares > 0) {
        entryPrice = currentPrice;
        cash -= shares * currentPrice;
        position = 1;
        trades.push({
          date: priceData[i].date,
          type: 'BUY',
          price: currentPrice,
          shares,
          value: shares * currentPrice,
        });
      }
    }
    else if (position === 1 && shortMA[i] < longMA[i] && shortMA[i - 1] >= longMA[i - 1]) {
      cash += shares * currentPrice;
      const profit = (currentPrice - entryPrice) * shares;
      trades.push({
        date: priceData[i].date,
        type: 'SELL',
        price: currentPrice,
        shares,
        value: shares * currentPrice,
        profit,
        profitPct: ((currentPrice - entryPrice) / entryPrice) * 100,
      });
      shares = 0;
      position = 0;
    }
  }
  
  if (position === 1) {
    const lastPrice = priceData[priceData.length - 1].price;
    cash += shares * lastPrice;
    const profit = (lastPrice - entryPrice) * shares;
    trades.push({
      date: priceData[priceData.length - 1].date,
      type: 'SELL',
      price: lastPrice,
      shares,
      value: shares * lastPrice,
      profit,
      profitPct: ((lastPrice - entryPrice) / entryPrice) * 100,
    });
  }
  
  const finalValue = cash;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const buyHoldReturn = ((priceData[priceData.length - 1].price - priceData[0].price) / priceData[0].price) * 100;
  
  return { trades, finalValue, totalReturn, buyHoldReturn };
}

// RSI Momentum Strategy
function runRSIMomentum(priceData, rsiPeriod, oversoldThreshold, overboughtThreshold, initialCapital) {
  const trades = [];
  let position = 0;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  
  // Calculate RSI
  const rsiValues = [];
  for (let i = 0; i < priceData.length; i++) {
    if (i < rsiPeriod) {
      rsiValues.push(50); // neutral starting value
      continue;
    }
    
    const changes = [];
    for (let j = i - rsiPeriod; j < i; j++) {
      changes.push(priceData[j + 1].price - priceData[j].price);
    }
    
    const gains = changes.filter(c => c > 0).reduce((sum, c) => sum + c, 0) / rsiPeriod;
    const losses = Math.abs(changes.filter(c => c < 0).reduce((sum, c) => sum + c, 0)) / rsiPeriod;
    
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));
    rsiValues.push(rsi);
  }
  
  for (let i = rsiPeriod + 1; i < priceData.length; i++) {
    const currentPrice = priceData[i].price;
    const currentRSI = rsiValues[i];
    
    // Buy when oversold
    if (position === 0 && currentRSI < oversoldThreshold) {
      shares = Math.floor(cash / currentPrice);
      if (shares > 0) {
        entryPrice = currentPrice;
        cash -= shares * currentPrice;
        position = 1;
        trades.push({
          date: priceData[i].date,
          type: 'BUY',
          price: currentPrice,
          shares,
          value: shares * currentPrice,
        });
      }
    }
    // Sell when overbought
    else if (position === 1 && currentRSI > overboughtThreshold) {
      cash += shares * currentPrice;
      const profit = (currentPrice - entryPrice) * shares;
      trades.push({
        date: priceData[i].date,
        type: 'SELL',
        price: currentPrice,
        shares,
        value: shares * currentPrice,
        profit,
        profitPct: ((currentPrice - entryPrice) / entryPrice) * 100,
      });
      shares = 0;
      position = 0;
    }
  }
  
  if (position === 1) {
    const lastPrice = priceData[priceData.length - 1].price;
    cash += shares * lastPrice;
    const profit = (lastPrice - entryPrice) * shares;
    trades.push({
      date: priceData[priceData.length - 1].date,
      type: 'SELL',
      price: lastPrice,
      shares,
      value: shares * lastPrice,
      profit,
      profitPct: ((lastPrice - entryPrice) / entryPrice) * 100,
    });
  }
  
  const finalValue = cash;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const buyHoldReturn = ((priceData[priceData.length - 1].price - priceData[0].price) / priceData[0].price) * 100;
  
  return { trades, finalValue, totalReturn, buyHoldReturn };
}

// Breakout Strategy
function runBreakout(priceData, breakoutPeriod, breakoutMultiplier, initialCapital) {
  const trades = [];
  let position = 0;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  
  for (let i = breakoutPeriod; i < priceData.length; i++) {
    const window = priceData.slice(i - breakoutPeriod, i);
    const high = Math.max(...window.map(d => d.price));
    const low = Math.min(...window.map(d => d.price));
    const range = high - low;
    
    const currentPrice = priceData[i].price;
    const breakoutLevel = high + (range * breakoutMultiplier);
    const breakdownLevel = low - (range * breakoutMultiplier);
    
    // Buy on upward breakout
    if (position === 0 && currentPrice > breakoutLevel) {
      shares = Math.floor(cash / currentPrice);
      if (shares > 0) {
        entryPrice = currentPrice;
        cash -= shares * currentPrice;
        position = 1;
        trades.push({
          date: priceData[i].date,
          type: 'BUY',
          price: currentPrice,
          shares,
          value: shares * currentPrice,
        });
      }
    }
    // Sell on downward breakdown
    else if (position === 1 && currentPrice < breakdownLevel) {
      cash += shares * currentPrice;
      const profit = (currentPrice - entryPrice) * shares;
      trades.push({
        date: priceData[i].date,
        type: 'SELL',
        price: currentPrice,
        shares,
        value: shares * currentPrice,
        profit,
        profitPct: ((currentPrice - entryPrice) / entryPrice) * 100,
      });
      shares = 0;
      position = 0;
    }
  }
  
  if (position === 1) {
    const lastPrice = priceData[priceData.length - 1].price;
    cash += shares * lastPrice;
    const profit = (lastPrice - entryPrice) * shares;
    trades.push({
      date: priceData[priceData.length - 1].date,
      type: 'SELL',
      price: lastPrice,
      shares,
      value: shares * lastPrice,
      profit,
      profitPct: ((lastPrice - entryPrice) / entryPrice) * 100,
    });
  }
  
  const finalValue = cash;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const buyHoldReturn = ((priceData[priceData.length - 1].price - priceData[0].price) / priceData[0].price) * 100;
  
  return { trades, finalValue, totalReturn, buyHoldReturn };
}

// Bollinger Bands Strategy
function runBollingerBands(priceData, period, stdDevMultiplier, initialCapital) {
  const trades = [];
  let position = 0;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  
  for (let i = period; i < priceData.length; i++) {
    const window = priceData.slice(i - period, i);
    const mean = window.reduce((sum, d) => sum + d.price, 0) / period;
    const variance = window.reduce((sum, d) => sum + Math.pow(d.price - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const currentPrice = priceData[i].price;
    const upperBand = mean + stdDevMultiplier * stdDev;
    const lowerBand = mean - stdDevMultiplier * stdDev;
    
    // Buy when price touches lower band
    if (position === 0 && currentPrice <= lowerBand) {
      shares = Math.floor(cash / currentPrice);
      if (shares > 0) {
        entryPrice = currentPrice;
        cash -= shares * currentPrice;
        position = 1;
        trades.push({
          date: priceData[i].date,
          type: 'BUY',
          price: currentPrice,
          shares,
          value: shares * currentPrice,
        });
      }
    }
    // Sell when price touches upper band
    else if (position === 1 && currentPrice >= upperBand) {
      cash += shares * currentPrice;
      const profit = (currentPrice - entryPrice) * shares;
      trades.push({
        date: priceData[i].date,
        type: 'SELL',
        price: currentPrice,
        shares,
        value: shares * currentPrice,
        profit,
        profitPct: ((currentPrice - entryPrice) / entryPrice) * 100,
      });
      shares = 0;
      position = 0;
    }
  }
  
  if (position === 1) {
    const lastPrice = priceData[priceData.length - 1].price;
    cash += shares * lastPrice;
    const profit = (lastPrice - entryPrice) * shares;
    trades.push({
      date: priceData[priceData.length - 1].date,
      type: 'SELL',
      price: lastPrice,
      shares,
      value: shares * lastPrice,
      profit,
      profitPct: ((lastPrice - entryPrice) / entryPrice) * 100,
    });
  }
  
  const finalValue = cash;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const buyHoldReturn = ((priceData[priceData.length - 1].price - priceData[0].price) / priceData[0].price) * 100;
  
  return { trades, finalValue, totalReturn, buyHoldReturn };
}

// Mean Reversion Strategy
function runMeanReversion(priceData, lookbackWindow, stdDevMultiplier, initialCapital) {
  const trades = [];
  let position = 0;
  let cash = initialCapital;
  let shares = 0;
  let entryPrice = 0;
  
  for (let i = lookbackWindow; i < priceData.length; i++) {
    const window = priceData.slice(i - lookbackWindow, i);
    const mean = window.reduce((sum, d) => sum + d.price, 0) / lookbackWindow;
    const variance = window.reduce((sum, d) => sum + Math.pow(d.price - mean, 2), 0) / lookbackWindow;
    const stdDev = Math.sqrt(variance);
    
    const currentPrice = priceData[i].price;
    const upperBand = mean + stdDevMultiplier * stdDev;
    const lowerBand = mean - stdDevMultiplier * stdDev;
    
    if (position === 0 && currentPrice < lowerBand) {
      shares = Math.floor(cash / currentPrice);
      if (shares > 0) {
        entryPrice = currentPrice;
        cash -= shares * currentPrice;
        position = 1;
        trades.push({
          date: priceData[i].date,
          type: 'BUY',
          price: currentPrice,
          shares,
          value: shares * currentPrice,
        });
      }
    }
    else if (position === 1 && currentPrice > mean) {
      cash += shares * currentPrice;
      const profit = (currentPrice - entryPrice) * shares;
      trades.push({
        date: priceData[i].date,
        type: 'SELL',
        price: currentPrice,
        shares,
        value: shares * currentPrice,
        profit,
        profitPct: ((currentPrice - entryPrice) / entryPrice) * 100,
      });
      shares = 0;
      position = 0;
    }
  }
  
  if (position === 1) {
    const lastPrice = priceData[priceData.length - 1].price;
    cash += shares * lastPrice;
    const profit = (lastPrice - entryPrice) * shares;
    trades.push({
      date: priceData[priceData.length - 1].date,
      type: 'SELL',
      price: lastPrice,
      shares,
      value: shares * lastPrice,
      profit,
      profitPct: ((lastPrice - entryPrice) / entryPrice) * 100,
    });
  }
  
  const finalValue = cash;
  const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
  const buyHoldReturn = ((priceData[priceData.length - 1].price - priceData[0].price) / priceData[0].price) * 100;
  
  return { trades, finalValue, totalReturn, buyHoldReturn };
}

function QuantBacktest() {
  const [tailwindLoaded, setTailwindLoaded] = useState(false);
  const [strategy, setStrategy] = useState('ma-crossover');
  const [strategyDropdownOpen, setStrategyDropdownOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('quant-backtest-theme');
      return saved ? saved === 'dark' : false;
    }
    return false;
  });
  
  const [shortWindow, setShortWindow] = useState(20);
  const [longWindow, setLongWindow] = useState(50);
  const [lookbackWindow, setLookbackWindow] = useState(20);
  const [stdDevMultiplier, setStdDevMultiplier] = useState(2);
  
  // RSI parameters
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [oversoldThreshold, setOversoldThreshold] = useState(30);
  const [overboughtThreshold, setOverboughtThreshold] = useState(70);
  
  // Breakout parameters
  const [breakoutPeriod, setBreakoutPeriod] = useState(20);
  const [breakoutMultiplier, setBreakoutMultiplier] = useState(0.1);
  
  // Bollinger Bands parameters
  const [bollingerPeriod, setBollingerPeriod] = useState(20);
  const [bollingerStdDev, setBollingerStdDev] = useState(2);
  
  const [days, setDays] = useState(365);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [volatility, setVolatility] = useState(0.02);
  
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!document.getElementById('tailwind-script')) {
      const tailwindScript = document.createElement('script');
      tailwindScript.id = 'tailwind-script';
      tailwindScript.src = 'https://cdn.tailwindcss.com';
      tailwindScript.onload = () => {
        setTimeout(() => setTailwindLoaded(true), 100);
      };
      document.head.appendChild(tailwindScript);
    } else {
      setTailwindLoaded(true);
    }
  }, []);

  useEffect(() => {
    document.body.style.background = darkMode ? '#0f1419' : '#ffffff';
    document.documentElement.style.minHeight = '100%';
    return () => {
      document.body.style.background = '';
      document.documentElement.style.minHeight = '';
    };
  }, [darkMode]);

  const toggleTheme = useCallback(() => {
    setDarkMode(prev => {
      const newMode = !prev;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('quant-backtest-theme', newMode ? 'dark' : 'light');
      }
      return newMode;
    });
  }, []);

  const theme = useMemo(() => ({
    bg: darkMode ? '#0f1419' : '#ffffff',
    cardBg: darkMode ? '#1a1f2e' : '#ffffff',
    text: darkMode ? '#e6edf3' : '#0f172a',
    textSecondary: darkMode ? '#8b949e' : '#64748b',
    textTertiary: darkMode ? '#6e7681' : '#94a3b8',
    border: darkMode ? '#30363d' : '#f0f0f0',
    inputBg: darkMode ? '#0d1117' : '#ffffff',
    inputText: darkMode ? '#e6edf3' : '#0f172a',
    shadow: darkMode ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.04)',
    dropdownBg: darkMode ? '#1a1f2e' : '#ffffff',
    hoverBg: darkMode ? '#30363d' : '#f8fafc',
    tableBorder: darkMode ? '#21262d' : '#f8fafc',
    tableHeaderBorder: darkMode ? '#30363d' : '#f0f0f0',
    infoBg: darkMode ? '#1a2332' : '#f8fafc',
    accentPrimary: '#3b82f6',
  }), [darkMode]);

  const runBacktest = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => {
      const priceData = generatePriceData(days, 100, volatility);
      
      let backtestResults;
      if (strategy === 'ma-crossover') {
        backtestResults = runMovingAverageCrossover(priceData, shortWindow, longWindow, initialCapital);
      } else if (strategy === 'mean-reversion') {
        backtestResults = runMeanReversion(priceData, lookbackWindow, stdDevMultiplier, initialCapital);
      } else if (strategy === 'rsi-momentum') {
        backtestResults = runRSIMomentum(priceData, rsiPeriod, oversoldThreshold, overboughtThreshold, initialCapital);
      } else if (strategy === 'breakout') {
        backtestResults = runBreakout(priceData, breakoutPeriod, breakoutMultiplier, initialCapital);
      } else if (strategy === 'bollinger') {
        backtestResults = runBollingerBands(priceData, bollingerPeriod, bollingerStdDev, initialCapital);
      }
      
      setResults({ ...backtestResults, priceData });
      setIsRunning(false);
    }, 100);
  }, [strategy, shortWindow, longWindow, lookbackWindow, stdDevMultiplier, rsiPeriod, oversoldThreshold, overboughtThreshold, breakoutPeriod, breakoutMultiplier, bollingerPeriod, bollingerStdDev, days, initialCapital, volatility]);

  const handleReset = useCallback(() => {
    setStrategy('ma-crossover');
    setShortWindow(20);
    setLongWindow(50);
    setLookbackWindow(20);
    setStdDevMultiplier(2);
    setRsiPeriod(14);
    setOversoldThreshold(30);
    setOverboughtThreshold(70);
    setBreakoutPeriod(20);
    setBreakoutMultiplier(0.1);
    setBollingerPeriod(20);
    setBollingerStdDev(2);
    setDays(365);
    setInitialCapital(10000);
    setVolatility(0.02);
    setResults(null);
  }, []);

  const metrics = useMemo(() => {
    if (!results) return null;
    
    const { trades, totalReturn, buyHoldReturn, finalValue } = results;
    const winningTrades = trades.filter(t => t.type === 'SELL' && t.profit > 0).length;
    const losingTrades = trades.filter(t => t.type === 'SELL' && t.profit < 0).length;
    const totalTrades = trades.filter(t => t.type === 'SELL').length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const profits = trades.filter(t => t.type === 'SELL' && t.profit).map(t => t.profit);
    const avgProfit = profits.length > 0 ? profits.reduce((sum, p) => sum + p, 0) / profits.length : 0;
    const maxProfit = profits.length > 0 ? Math.max(...profits) : 0;
    const maxLoss = profits.length > 0 ? Math.min(...profits) : 0;
    
    return {
      finalValue,
      totalReturn,
      buyHoldReturn,
      alpha: totalReturn - buyHoldReturn,
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      avgProfit,
      maxProfit,
      maxLoss,
    };
  }, [results]);

  if (!tailwindLoaded) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ fontFamily: 'Inter, -apple-system, sans-serif', background: theme.bg, minHeight: '100vh', padding: '48px' }}>
      {/* Header */}
      <div style={{ marginBottom: '48px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ maxWidth: '720px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: '300', color: theme.text, letterSpacing: '-0.02em', marginBottom: '12px' }}>
            Buy & Sell Strategy Tester
          </h1>
          <p style={{ fontSize: '16px', color: theme.textSecondary, lineHeight: '1.6' }}>
            See how much money you would have made using different automated buying and selling rules. Pick a strategy, adjust the settings, and we'll show you the results.
          </p>
        </div>
        
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          style={{
            padding: '12px 20px',
            borderRadius: '12px',
            background: theme.cardBg,
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: '500',
            color: theme.text,
          }}
        >
          {darkMode ? (
            <>
              <span style={{ fontSize: '18px' }}>☀️</span>
              <span>Light</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '18px' }}>🌙</span>
              <span>Dark</span>
            </>
          )}
        </button>
      </div>

      {/* Configuration Card */}
      <div style={{ 
        background: theme.cardBg,
        borderRadius: '16px',
        padding: '40px',
        marginBottom: '32px',
        boxShadow: theme.shadow,
        border: `1px solid ${theme.border}`,
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: theme.text, marginBottom: '8px' }}>
          Choose Your Strategy
        </h2>
        <p style={{ fontSize: '14px', color: theme.textSecondary, marginBottom: '32px', lineHeight: '1.5' }}>
          Pick a buying and selling rule, then customize how aggressive it is. We'll simulate what would have happened.
        </p>

        <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          {/* Strategy Selector */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
              Buying & Selling Rule
            </label>
            <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
              How should the system decide when to buy and when to sell?
            </p>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setStrategyDropdownOpen(!strategyDropdownOpen)}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.border}`,
                  fontSize: '15px',
                  background: theme.inputBg,
                  width: '100%',
                  textAlign: 'left',
                  color: theme.inputText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
                <span>
                  {strategy === 'ma-crossover' ? 'Trend Following' : 
                   strategy === 'mean-reversion' ? 'Buy Low, Sell High' :
                   strategy === 'rsi-momentum' ? 'RSI Momentum' :
                   strategy === 'breakout' ? 'Breakout Trading' :
                   'Bollinger Bands'}
                </span>
                <span style={{ fontSize: '12px', color: theme.textSecondary }}>▼</span>
              </button>
              {strategyDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  background: theme.dropdownBg,
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  boxShadow: theme.shadow,
                  zIndex: 10,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => {
                      setStrategy('ma-crossover');
                      setStrategyDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    style={{ 
                      padding: '14px 16px', 
                      fontSize: '14px', 
                      width: '100%', 
                      textAlign: 'left',
                      color: theme.text,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Trend Following</div>
                    <div style={{ fontSize: '12px', color: theme.textTertiary }}>Buy when price is rising, sell when falling</div>
                  </button>
                  <div style={{ height: '1px', background: theme.border, margin: '0 12px' }} />
                  <button
                    onClick={() => {
                      setStrategy('mean-reversion');
                      setStrategyDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    style={{ 
                      padding: '14px 16px', 
                      fontSize: '14px', 
                      width: '100%', 
                      textAlign: 'left',
                      color: theme.text,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Buy Low, Sell High</div>
                    <div style={{ fontSize: '12px', color: theme.textTertiary }}>Buy when price drops, sell when it recovers</div>
                  </button>
                  <div style={{ height: '1px', background: theme.border, margin: '0 12px' }} />
                  <button
                    onClick={() => {
                      setStrategy('rsi-momentum');
                      setStrategyDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    style={{ 
                      padding: '14px 16px', 
                      fontSize: '14px', 
                      width: '100%', 
                      textAlign: 'left',
                      color: theme.text,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>RSI Momentum</div>
                    <div style={{ fontSize: '12px', color: theme.textTertiary }}>Buy oversold, sell overbought conditions</div>
                  </button>
                  <div style={{ height: '1px', background: theme.border, margin: '0 12px' }} />
                  <button
                    onClick={() => {
                      setStrategy('breakout');
                      setStrategyDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    style={{ 
                      padding: '14px 16px', 
                      fontSize: '14px', 
                      width: '100%', 
                      textAlign: 'left',
                      color: theme.text,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Breakout Trading</div>
                    <div style={{ fontSize: '12px', color: theme.textTertiary }}>Buy when price breaks above recent highs</div>
                  </button>
                  <div style={{ height: '1px', background: theme.border, margin: '0 12px' }} />
                  <button
                    onClick={() => {
                      setStrategy('bollinger');
                      setStrategyDropdownOpen(false);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.hoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    style={{ 
                      padding: '14px 16px', 
                      fontSize: '14px', 
                      width: '100%', 
                      textAlign: 'left',
                      color: theme.text,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Bollinger Bands</div>
                    <div style={{ fontSize: '12px', color: theme.textTertiary }}>Trade reversals at volatility bands</div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Starting Amount */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
              Starting Amount
            </label>
            <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
              How much money to start with (virtual)
            </p>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(Number(e.target.value))}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
                fontSize: '15px',
                width: '100%',
                color: theme.inputText,
                background: theme.inputBg,
              }}
            />
          </div>
        </div>

        <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px', marginTop: '32px' }}>
          {/* Test Period */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
              Test Period
            </label>
            <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
              Days of price history to simulate (365 = 1 year)
            </p>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                border: `1px solid ${theme.border}`,
                fontSize: '15px',
                width: '100%',
                color: theme.inputText,
                background: theme.inputBg,
              }}
            />
          </div>

          {/* Volatility */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text }}>
                Price Choppiness
              </label>
              <span style={{ fontSize: '14px', fontWeight: '600', color: theme.accentPrimary }}>
                {volatility.toFixed(3)}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
              How wild the price swings are (calm to very choppy)
            </p>
            <div style={{ position: 'relative', paddingTop: '8px', paddingBottom: '8px' }}>
              <input
                type="range"
                min="0.01"
                max="0.05"
                step="0.001"
                value={volatility}
                onChange={(e) => setVolatility(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: darkMode 
                    ? `linear-gradient(to right, ${theme.accentPrimary} 0%, ${theme.accentPrimary} ${((volatility - 0.01) / 0.04) * 100}%, ${theme.border} ${((volatility - 0.01) / 0.04) * 100}%, ${theme.border} 100%)`
                    : `linear-gradient(to right, ${theme.accentPrimary} 0%, ${theme.accentPrimary} ${((volatility - 0.01) / 0.04) * 100}%, #e2e8f0 ${((volatility - 0.01) / 0.04) * 100}%, #e2e8f0 100%)`,
                  outline: 'none',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  cursor: 'pointer',
                }}
              />
              <style>{`
                /* Line up label, description, and input across both columns of a
                   field row, so a wrapped description doesn't push one input lower */
                .field-row > div {
                  display: grid;
                  grid-row: span 3;
                  grid-template-rows: subgrid;
                  row-gap: 0;
                }
                input[type="range"]::-webkit-slider-thumb {
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: ${theme.accentPrimary};
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                  border: 3px solid ${theme.cardBg};
                }
                input[type="range"]::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: ${theme.accentPrimary};
                  cursor: pointer;
                  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                  border: 3px solid ${theme.cardBg};
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }
                input[type="range"]::-moz-range-thumb:hover {
                  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }
              `}</style>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: theme.textTertiary }}>
                <span>Calm</span>
                <span>Moderate</span>
                <span>Very Choppy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Strategy-specific parameters */}
        <div style={{ marginTop: '40px', paddingTop: '40px', borderTop: `1px solid ${theme.border}` }}>
          <h3 style={{ fontSize: '17px', fontWeight: '600', color: theme.text, marginBottom: '6px' }}>
            Adjust the Sensitivity
          </h3>
          <p style={{ fontSize: '13px', color: theme.textSecondary, marginBottom: '24px', lineHeight: '1.5' }}>
            {strategy === 'ma-crossover' 
              ? 'Control how quickly the system reacts when prices go up or down'
              : strategy === 'mean-reversion'
              ? 'Set how much the price needs to drop before it triggers a buy'
              : strategy === 'rsi-momentum'
              ? 'Adjust when to buy (oversold) and sell (overbought) based on momentum'
              : strategy === 'breakout'
              ? 'Define what counts as a strong breakout above recent price levels'
              : 'Set the price bands that trigger buy and sell signals'}
          </p>
          
          {strategy === 'ma-crossover' ? (
            <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Quick Reaction Time
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Lower number = reacts faster (default: 20 days)
                </p>
                <input
                  type="number"
                  value={shortWindow}
                  onChange={(e) => setShortWindow(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Slow Reaction Time
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Higher number = reacts slower (default: 50 days)
                </p>
                <input
                  type="number"
                  value={longWindow}
                  onChange={(e) => setLongWindow(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
            </div>
          ) : strategy === 'mean-reversion' ? (
            <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  How Far Back to Look
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Number of days to consider for the average price (default: 20)
                </p>
                <input
                  type="number"
                  value={lookbackWindow}
                  onChange={(e) => setLookbackWindow(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  How Low Before Buying
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Higher number = wait for bigger price drops (default: 2)
                </p>
                <input
                  type="number"
                  step="0.1"
                  value={stdDevMultiplier}
                  onChange={(e) => setStdDevMultiplier(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
            </div>
          ) : strategy === 'rsi-momentum' ? (
            <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 24px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  RSI Period
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Days to calculate momentum (default: 14)
                </p>
                <input
                  type="number"
                  value={rsiPeriod}
                  onChange={(e) => setRsiPeriod(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Oversold Level
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Buy when RSI drops below (default: 30)
                </p>
                <input
                  type="number"
                  value={oversoldThreshold}
                  onChange={(e) => setOversoldThreshold(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Overbought Level
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Sell when RSI rises above (default: 70)
                </p>
                <input
                  type="number"
                  value={overboughtThreshold}
                  onChange={(e) => setOverboughtThreshold(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
            </div>
          ) : strategy === 'breakout' ? (
            <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Lookback Period
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Days to identify high/low range (default: 20)
                </p>
                <input
                  type="number"
                  value={breakoutPeriod}
                  onChange={(e) => setBreakoutPeriod(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Breakout Threshold
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  How far above high to trigger (default: 0.1 = 10%)
                </p>
                <input
                  type="number"
                  step="0.01"
                  value={breakoutMultiplier}
                  onChange={(e) => setBreakoutMultiplier(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Band Period
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Days to calculate moving average (default: 20)
                </p>
                <input
                  type="number"
                  value={bollingerPeriod}
                  onChange={(e) => setBollingerPeriod(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '6px', display: 'block' }}>
                  Band Width
                </label>
                <p style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.4' }}>
                  Standard deviations from average (default: 2)
                </p>
                <input
                  type="number"
                  step="0.1"
                  value={bollingerStdDev}
                  onChange={(e) => setBollingerStdDev(Number(e.target.value))}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: `1px solid ${theme.border}`,
                    fontSize: '15px',
                    width: '100%',
                    color: theme.inputText,
                    background: theme.inputBg,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ marginTop: '32px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={runBacktest}
            disabled={isRunning}
            style={{
              padding: '16px 40px',
              borderRadius: '12px',
              background: isRunning ? '#94a3b8' : theme.accentPrimary,
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              border: 'none',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: isRunning ? 'none' : '0 4px 16px rgba(59, 130, 246, 0.2)',
            }}
          >
            {isRunning ? 'Running Simulation...' : 'Run Simulation'}
          </button>
          
          <button
            onClick={handleReset}
            disabled={isRunning}
            style={{
              padding: '16px 32px',
              borderRadius: '12px',
              background: darkMode ? '#374151' : '#f1f5f9',
              color: darkMode ? '#d1d5db' : '#64748b',
              fontSize: '15px',
              fontWeight: '600',
              border: `1px solid ${theme.border}`,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.5 : 1,
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Results */}
      {metrics && (
        <>
          {/* Info Banner */}
          <div style={{
            background: theme.infoBg,
            borderRadius: '12px',
            padding: '20px 24px',
            marginBottom: '32px',
            border: `1px solid ${theme.border}`,
          }}>
            <p style={{ fontSize: '14px', color: theme.textSecondary, lineHeight: '1.6' }}>
              💡 <span style={{ fontWeight: '600', color: theme.text }}>What am I looking at?</span> These numbers show how much money you would have made (or lost) if you had used this buying and selling strategy over the past year. Green = profit, Red = loss.
            </p>
          </div>

          {/* Performance Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
            <MetricCard 
              label="Your Return" 
              sublabel="With this buying & selling strategy"
              value={`${metrics.totalReturn.toFixed(2)}%`} 
              positive={metrics.totalReturn > 0}
              negative={metrics.totalReturn < 0}
              theme={theme}
            />
            <MetricCard 
              label="Buy Once & Hold" 
              sublabel="If you just bought and never sold"
              value={`${metrics.buyHoldReturn.toFixed(2)}%`}
              positive={metrics.buyHoldReturn > 0}
              negative={metrics.buyHoldReturn < 0}
              theme={theme}
            />
            <MetricCard 
              label="Extra Gain" 
              sublabel="How much more you made by trading"
              value={`${metrics.alpha.toFixed(2)}%`} 
              positive={metrics.alpha > 0}
              negative={metrics.alpha < 0}
              theme={theme}
            />
            <MetricCard 
              label="Ending Balance" 
              sublabel={`Started with $${initialCapital.toLocaleString()}`}
              value={`$${metrics.finalValue.toLocaleString()}`}
              theme={theme}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '32px' }}>
            <MetricCard 
              label="Win Rate" 
              sublabel="How often you made money"
              value={`${metrics.winRate.toFixed(1)}%`}
              theme={theme}
            />
            <MetricCard 
              label="Times You Traded" 
              sublabel="Total buy & sell pairs"
              value={metrics.totalTrades.toString()}
              theme={theme}
            />
            <MetricCard 
              label="Average Gain" 
              sublabel="Typical profit per trade"
              value={`$${metrics.avgProfit.toFixed(2)}`}
              positive={metrics.avgProfit > 0}
              negative={metrics.avgProfit < 0}
              theme={theme}
            />
            <MetricCard 
              label="Worst Trade" 
              sublabel="Your biggest single loss"
              value={`$${metrics.maxLoss.toFixed(2)}`} 
              negative={metrics.maxLoss < 0}
              theme={theme}
            />
          </div>

          {/* Trade History */}
          <div style={{ 
            background: theme.cardBg,
            borderRadius: '16px',
            padding: '32px',
            boxShadow: theme.shadow,
            border: `1px solid ${theme.border}`,
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: theme.text, marginBottom: '6px' }}>
              Every Buy and Sell
            </h2>
            <p style={{ fontSize: '14px', color: theme.textSecondary, marginBottom: '24px' }}>
              Complete history showing when you bought, when you sold, and how much you made ({results.trades.length} trades total)
            </p>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead style={{ borderBottom: `2px solid ${theme.tableHeaderBorder}`, position: 'sticky', top: 0, background: theme.cardBg }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: theme.textSecondary, fontSize: '12px' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: theme.textSecondary, fontSize: '12px' }}>Action</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: theme.textSecondary, fontSize: '12px' }}>Price</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: theme.textSecondary, fontSize: '12px' }}>Shares</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: theme.textSecondary, fontSize: '12px' }}>Total Value</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: theme.textSecondary, fontSize: '12px' }}>Profit/Loss</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontWeight: '600', color: theme.textSecondary, fontSize: '12px' }}>% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {results.trades.map((trade, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${theme.tableBorder}` }}>
                      <td style={{ padding: '12px', color: theme.textTertiary, fontSize: '13px' }}>{trade.date}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: trade.type === 'BUY' ? (darkMode ? '#1e3a5f' : '#dbeafe') : (darkMode ? '#5f1e1e' : '#fee2e2'),
                          color: trade.type === 'BUY' ? (darkMode ? '#93c5fd' : '#1e40af') : (darkMode ? '#fca5a5' : '#991b1b'),
                        }}>
                          {trade.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: theme.text, fontSize: '13px' }}>
                        ${trade.price.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: theme.textTertiary, fontSize: '13px' }}>
                        {trade.shares}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: theme.text, fontSize: '13px' }}>
                        ${trade.value.toFixed(2)}
                      </td>
                      <td style={{ 
                        padding: '12px', 
                        textAlign: 'right',
                        color: trade.profit > 0 ? '#10b981' : trade.profit < 0 ? '#ef4444' : theme.textTertiary,
                        fontSize: '13px',
                        fontWeight: '500',
                      }}>
                        {trade.profit ? `$${trade.profit.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ 
                        padding: '12px', 
                        textAlign: 'right',
                        color: trade.profitPct > 0 ? '#10b981' : trade.profitPct < 0 ? '#ef4444' : theme.textTertiary,
                        fontWeight: '600',
                        fontSize: '13px',
                      }}>
                        {trade.profitPct ? `${trade.profitPct > 0 ? '+' : ''}${trade.profitPct.toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, sublabel, value, positive, negative, theme }) {
  return (
    <div style={{ 
      background: theme.cardBg,
      borderRadius: '16px',
      padding: '28px 24px',
      boxShadow: theme.shadow,
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '12px', color: theme.textTertiary, marginBottom: '12px', lineHeight: '1.3' }}>
        {sublabel}
      </div>
      <div style={{ 
        fontSize: '32px', 
        fontWeight: '300',
        letterSpacing: '-0.02em',
        color: positive ? '#10b981' : negative ? '#ef4444' : theme.text
      }}>
        {value}
      </div>
    </div>
  );
}

export default QuantBacktest;