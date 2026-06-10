import { Button, ButtonProps } from '@/components/ui/button'

type CreateButtonProps = ButtonProps

export function CreateButton({ children = '新規作成', ...props }: CreateButtonProps) {
    return (
        <Button
            {...props}
            className={`h-auto rounded-none border-none text-lg py-6 px-8 tracking-widest text-white transition-colors ${props.className || ''}`}
            style={{
                backgroundColor: 'var(--brand-navy)',
                fontFamily: 'var(--font-mincho)',
                fontWeight: 500,
                letterSpacing: '0.3em',
                ...(props.style || {}),
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--brand-navy-dark)'
                props.onMouseEnter?.(e)
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--brand-navy)'
                props.onMouseLeave?.(e)
            }}
        >
            {children}
        </Button>
    )
}
