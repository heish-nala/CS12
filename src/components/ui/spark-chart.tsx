'use client';

interface SparkChartProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    showTrend?: boolean;
}

export function SparkChart({
    data,
    width = 60,
    height = 20,
    color = 'currentColor',
    showTrend = true,
}: SparkChartProps) {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Calculate points for the line
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');

    // Determine trend
    const trend = data[data.length - 1] - data[0];
    const trendColor = trend >= 0 ? 'var(--color-emerald-500)' : 'var(--color-red-500)';
    const finalColor = showTrend ? trendColor : color;

    // Create area fill path
    const areaPath = `M 0,${height} L ${points.split(' ').map(p => p).join(' L ')} L ${width},${height} Z`;

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
        >
            {/* Gradient fill under the line */}
            <defs>
                <linearGradient id={`spark-gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={finalColor} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={finalColor} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path
                d={areaPath}
                fill={`url(#spark-gradient-${color})`}
            />
            {/* The line */}
            <polyline
                points={points}
                fill="none"
                stroke={finalColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            <circle
                cx={width}
                cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
                r="2"
                fill={finalColor}
            />
        </svg>
    );
}

// Helper to generate sample trend data from a current value
export function generateTrendData(currentValue: number, volatility: number = 0.15, points: number = 7): number[] {
    const data: number[] = [];
    let value = currentValue * (1 - volatility * 2);

    for (let i = 0; i < points - 1; i++) {
        data.push(Math.max(0, Math.round(value)));
        value += (currentValue - value) / (points - i) + (Math.random() - 0.3) * currentValue * volatility;
    }
    data.push(currentValue);

    return data;
}
