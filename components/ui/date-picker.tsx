import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Label } from "./label"

interface DatePickerProps {
  label?: string
  value?: string // ISO date string (YYYY-MM-DD)
  onChange?: (value: string | undefined) => void // Returns ISO date string
  error?: string
  disabled?: boolean
  minValue?: string // ISO date string
  maxValue?: string // ISO date string
  id?: string
  required?: boolean
}

/**
 * DatePicker Component
 *
 * Uses react-day-picker and date-fns
 * Displays dates in DD/MM/YYYY format (British/Malaysian standard)
 * Stores dates internally as ISO strings (YYYY-MM-DD) for database compatibility
 */
export function DatePicker({
  label,
  value,
  onChange,
  error,
  disabled = false,
  minValue,
  maxValue,
  id,
  required = false
}: DatePickerProps) {
  // Convert ISO string to Date
  const dateValue = value ? new Date(value) : undefined
  const minDate = minValue ? new Date(minValue) : undefined
  const maxDate = maxValue ? new Date(maxValue) : undefined

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Convert Date to ISO string (YYYY-MM-DD)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const isoString = `${year}-${month}-${day}`
      onChange?.(isoString)
    } else {
      onChange?.(undefined)
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateValue && "text-muted-foreground",
              error && "border-red-500"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateValue ? format(dateValue, "dd/MM/yyyy") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            disabled={(date) => {
              if (disabled) return true
              if (minDate && date < minDate) return true
              if (maxDate && date > maxDate) return true
              return false
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

/**
 * Format date string for display
 * Converts YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return ''

  try {
    const date = new Date(dateString)
    return format(date, 'dd/MM/yyyy')
  } catch {
    return dateString
  }
}

/**
 * Format date for display in lists/tables
 * Returns format like "15 Jan 2025"
 */
export function formatDateShort(dateString: string | undefined): string {
  if (!dateString) return ''

  try {
    const date = new Date(dateString)
    return format(date, 'd MMM yyyy')
  } catch {
    return dateString
  }
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
