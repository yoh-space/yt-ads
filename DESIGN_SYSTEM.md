# YT Advertising Dashboard Design System

## Design Tokens (from globals.css)

### Colors
- **Navy**: `bg-navy text-white` (#002e4b)
- **Cyan**: `bg-cyan text-white` (#19c4d2) 
- **Gold**: `bg-gold text-white` (#e2ad3c)
- **Violet**: `bg-violet text-white` (#8874dc)
- **Blue**: `bg-blue text-white` (#558ce4)
- **Green**: `bg-green text-white` (#48ad8a)
- **Coral**: `bg-coral text-white` (#e87566)

### Background & Surface Colors
- **Canvas**: `bg-canvas` (#f3f6f8)
- **Card**: `bg-white border border-line rounded-lg shadow-sm`
- **Line/Border**: `border-line` (#dfe8ed)

### Text Colors
- **Primary**: `text-navy` (#002e4b)
- **Secondary**: `text-gray-600` 
- **Muted**: `text-muted` (#6e8191)
- **Ink**: `text-ink` (#071b2c)

## Component Patterns

### Cards & Panels
```jsx
// Main panel container
<div className="bg-white border border-line rounded-lg shadow-sm overflow-hidden">
  {/* Panel header */}
  <div className="px-6 py-4 border-b border-line bg-gray-50">
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">KICKER</span>
        <h2 className="text-lg font-bold text-navy mt-1">Panel Title</h2>
        <p className="text-sm text-gray-600 mt-1">Panel description</p>
      </div>
      <div className="flex items-center gap-2">
        {/* Actions */}
      </div>
    </div>
  </div>
  
  {/* Panel content */}
  <div className="p-6">
    {/* Content */}
  </div>
</div>
```

### Buttons
```jsx
// Primary button
<button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-navy text-white shadow-sm transition-colors hover:bg-navy-2 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">

// Secondary button  
<button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-navy transition-colors hover:border-cyan hover:bg-cyan/5 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2">

// Small button
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-navy text-white shadow-sm transition-colors hover:bg-navy-2">

// Text button
<button className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:text-cyan-dark transition-colors">
```

### Status Pills
```jsx
// Success
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green/10 text-green">
  
// Warning
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gold/10 text-gold">
  
// Error/Alert
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-coral/10 text-coral">

// Info
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue/10 text-blue">
```

### Form Elements
```jsx
// Input
<input className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors" />

// Select
<select className="w-full px-3 py-2 text-sm border border-line rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-colors">

// Label
<label className="block text-sm font-semibold text-navy mb-2">

// Field error
<small className="block mt-1 text-xs font-medium text-coral">
```

### Layout Patterns

#### Jobs Kanban Board
```jsx
<div className="space-y-6">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-bold text-navy">Production Queue</h2>
      <p className="text-sm text-gray-600">{openJobs} open cards</p>
    </div>
    {/* Actions */}
  </div>
  
  {/* Kanban columns */}
  <div className="grid grid-cols-3 gap-6">
    {columns.map(status => (
      <div key={status} className="bg-white border border-line rounded-lg overflow-hidden">
        {/* Column header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-line">
          <h3 className="font-semibold text-navy">{status}</h3>
          <span className="text-sm font-medium text-gray-500">{count}</span>
        </div>
        
        {/* Cards */}
        <div className="p-4 space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="p-4 bg-gray-50 border border-line rounded-lg hover:shadow-sm transition-shadow">
              {/* Job card content */}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
</div>
```

#### Machine Cards Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {machines.map(machine => (
    <div key={machine.id} className="bg-white border border-line rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* Machine icon and status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-10 h-10 rounded-lg",
            machine.status === "Running" ? "bg-green/10 text-green" : "bg-gray-100 text-gray-600"
          )}>
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-navy">{machine.name}</h3>
            <p className="text-sm text-gray-600">{machine.code}</p>
          </div>
        </div>
        <StatusPill variant={statusVariant}>{machine.status}</StatusPill>
      </div>
      
      {/* Machine details */}
      <div className="space-y-3">
        {/* Content */}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-line">
        {/* Action buttons */}
      </div>
    </div>
  ))}
</div>
```

#### Data Tables
```jsx
<div className="bg-white border border-line rounded-lg overflow-hidden">
  {/* Table header */}
  <div className="px-6 py-4 border-b border-line bg-gray-50">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-navy">Table Title</h3>
      {/* Search and filters */}
    </div>
  </div>
  
  {/* Table */}
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-gray-50 border-b border-line">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Header
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        <tr className="hover:bg-gray-50 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap text-sm text-navy">
            Cell content
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### Modal Patterns (Already Well-Implemented)
The ModalShell component already follows good Tailwind practices with:
- Backdrop: `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm`
- Container: `w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-100`
- Header: Proper typography and spacing
- Footer: Consistent button styling

## Responsive Design Guidelines

### Breakpoints
- `sm:` - 640px and up
- `md:` - 768px and up  
- `lg:` - 1024px and up
- `xl:` - 1280px and up

### Grid Patterns
- Mobile: Single column `grid-cols-1`
- Tablet: Two columns `md:grid-cols-2`
- Desktop: Three+ columns `lg:grid-cols-3 xl:grid-cols-4`

### Typography Scale
- **Display**: `text-2xl font-bold text-navy`
- **Heading**: `text-lg font-bold text-navy` 
- **Subheading**: `text-base font-semibold text-navy`
- **Body**: `text-sm text-gray-600`
- **Caption**: `text-xs text-gray-500`
- **Label**: `text-xs font-mono font-bold tracking-wider uppercase text-cyan-dark`

## Animation & Transitions
- **Hover effects**: `transition-colors hover:bg-gray-50`
- **Focus states**: `focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2`
- **Button interactions**: `transition-all duration-200 hover:shadow-md`
- **Card hover**: `hover:shadow-sm transition-shadow`

## Spacing Scale
- **Tight spacing**: `gap-2 p-2` (8px)
- **Normal spacing**: `gap-4 p-4` (16px) 
- **Loose spacing**: `gap-6 p-6` (24px)
- **Section spacing**: `space-y-8` (32px between sections)

## Icon Guidelines
- **Small icons**: 16px (`size={16}`)
- **Medium icons**: 20px (`size={20}`)
- **Large icons**: 24px (`size={24}`)
- Always use consistent sizing within the same context