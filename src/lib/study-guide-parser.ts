/**
 * Study Guide Content Parser
 * Parses markdown study guide content into structured study items
 */

export type ParsedStudyItem = {
  id: string
  section: string
  content: string
  estimatedMinutes: number
  order: number
}

/**
 * Parse markdown content into study items
 * Extracts individual concepts/mini-concepts as separate review items
 * Each item represents a single concept that needs to be reviewed
 */
export function parseStudyGuideContent(content: string): ParsedStudyItem[] {
  if (!content || content.trim().length === 0) {
    return []
  }

  const items: ParsedStudyItem[] = []
  const lines = content.split('\n')
  
  let currentSection = 'Introduction'
  let order = 0
  let inCodeBlock = false
  let currentConcept: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      // Save concept before code block if exists
      if (currentConcept.length > 0 && !inCodeBlock) {
        const concept = extractConcept(currentSection, currentConcept.join('\n'), order++)
        if (concept) items.push(concept)
        currentConcept = []
      }
      continue
    }

    // Skip code block content for parsing (but include code blocks as part of concepts)
    if (inCodeBlock) {
      if (currentConcept.length > 0 || line.trim().length > 0) {
        currentConcept.push(line)
      }
      continue
    }

    // Detect headers (h1, h2, h3, h4) - these mark section boundaries
    const h1Match = line.match(/^# (.+)$/)
    const h2Match = line.match(/^## (.+)$/)
    const h3Match = line.match(/^### (.+)$/)
    const h4Match = line.match(/^#### (.+)$/)

    if (h1Match || h2Match || h3Match || h4Match) {
      // Save current concept before starting new section
      if (currentConcept.length > 0) {
        const concept = extractConcept(currentSection, currentConcept.join('\n'), order++)
        if (concept) items.push(concept)
        currentConcept = []
      }

      // Start new section
      const headerText = (h1Match?.[1] || h2Match?.[1] || h3Match?.[1] || h4Match?.[1]).trim()
      currentSection = headerText
    } else {
      // Check if this line starts a new concept
      const isBulletPoint = /^[-*•]\s/.test(line.trim())
      const isNumberedItem = /^\d+[.)]\s/.test(line.trim())
      const isDefinition = /^[A-Z][^.!?]*:/.test(line.trim()) // Lines starting with capital letter followed by colon
      const isQuestion = /\?$/.test(line.trim()) && line.trim().length > 20 // Questions end with ?
      
      // If we hit a new concept marker and have accumulated content, save it
      if ((isBulletPoint || isNumberedItem || isDefinition || isQuestion) && currentConcept.length > 0) {
        const concept = extractConcept(currentSection, currentConcept.join('\n'), order++)
        if (concept) items.push(concept)
        currentConcept = []
      }

      // Add line to current concept
      if (line.trim().length > 0) {
        currentConcept.push(line)
      } else if (currentConcept.length > 0) {
        // Empty line separates concepts - save current concept
        const concept = extractConcept(currentSection, currentConcept.join('\n'), order++)
        if (concept) items.push(concept)
        currentConcept = []
      }
    }
  }

  // Save final concept
  if (currentConcept.length > 0) {
    const concept = extractConcept(currentSection, currentConcept.join('\n'), order++)
    if (concept) items.push(concept)
  }

  // If no concepts found, try to extract from paragraphs
  if (items.length === 0 && content.trim().length > 0) {
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    paragraphs.forEach((para, idx) => {
      const concept = extractConcept('Study Guide', para.trim(), idx)
      if (concept) items.push(concept)
    })
  }

  return items
}

/**
 * Extract a single concept from content
 * Creates a focused study item representing one reviewable concept
 */
function extractConcept(section: string, content: string, order: number): ParsedStudyItem | null {
  if (!content || content.trim().length === 0) {
    return null
  }

  // Clean up the content
  content = content.trim()
  
  // Extract concept title/name from the first line or first sentence
  let conceptTitle = section
  const firstLine = content.split('\n')[0].trim()
  
  // Remove bullet/numbering markers for title
  const cleanedFirstLine = firstLine
    .replace(/^[-*•]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim()
  
  // Extract title from first line (up to first period, colon, or 60 chars)
  if (cleanedFirstLine.length > 0) {
    const titleMatch = cleanedFirstLine.match(/^([^:.]{1,60})/)
    if (titleMatch) {
      conceptTitle = titleMatch[1].trim()
      // If title is too short or generic, use section name
      if (conceptTitle.length < 5 || conceptTitle.toLowerCase() === 'key' || conceptTitle.toLowerCase() === 'important') {
        conceptTitle = section
      } else {
        // Combine section and concept title if they're different
        if (conceptTitle.toLowerCase() !== section.toLowerCase()) {
          conceptTitle = `${section}: ${conceptTitle}`
        }
      }
    }
  }

  // Estimate time based on content
  const wordCount = content.split(/\s+/).length
  const hasQuestions = /(?:question|practice|exercise|problem|quiz|\?)/i.test(content)
  const hasFormulas = /[=+\-*/^()]/.test(content)
  const hasCode = /```/.test(content)
  const hasMultipleBullets = content.split('\n').filter(l => l.trim().match(/^[-*•]\s/)).length > 1

  // Base estimate: ~200 words per minute for reading
  // Adjustments:
  // - Questions/exercises: +50% time
  // - Formulas: +30% time
  // - Code blocks: +40% time
  // - Multiple bullets: +20% time
  let baseMinutes = Math.max(5, Math.ceil(wordCount / 200))
  
  if (hasQuestions) baseMinutes = Math.ceil(baseMinutes * 1.5)
  if (hasFormulas) baseMinutes = Math.ceil(baseMinutes * 1.3)
  if (hasCode) baseMinutes = Math.ceil(baseMinutes * 1.4)
  if (hasMultipleBullets) baseMinutes = Math.ceil(baseMinutes * 1.2)

  // Concepts should be focused: minimum 10 minutes, maximum 45 minutes per concept
  // This ensures each concept is a manageable review unit
  const estimatedMinutes = Math.min(45, Math.max(10, baseMinutes))

  return {
    id: `${conceptTitle}-${order}-${Date.now()}`.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase(),
    section: conceptTitle,
    content: content,
    estimatedMinutes,
    order,
  }
}

/**
 * Estimate total time for all study items
 */
export function estimateTotalTime(items: ParsedStudyItem[]): number {
  return items.reduce((total, item) => total + item.estimatedMinutes, 0)
}

