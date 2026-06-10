/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
		"./app/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
	],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			mincho: 'var(--font-mincho)',
  			gothic: 'var(--font-gothic)',
  			garamond: 'var(--font-garamond)',
  		},
  		colors: {
  			// 玉泉院ブランドカラー
  			brand: {
  				navy: 'var(--brand-navy)',
  				'navy-dark': 'var(--brand-navy-dark)',
  				'navy-light': 'var(--brand-navy-light)',
  				gold: 'var(--brand-gold)',
  				'gold-light': 'var(--brand-gold-light)',
  				'gold-soft': 'var(--brand-gold-soft)',
  				red: 'var(--brand-red)',
  				'red-accent': 'var(--brand-red-accent)',
  				ivory: 'var(--brand-ivory)',
  				'ivory-light': 'var(--brand-ivory-light)',
  				border: 'var(--brand-border)',
  				'input-border': 'var(--brand-input-border)',
  				text: 'var(--brand-text)',
  				'text-muted': 'var(--brand-text-muted)',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}

