import { Box, Container, Typography } from '@mui/material'

/**
 * Minimal markdown-to-JSX renderer for the static legal documents
 * (IMPRESSUM.md, DATENSCHUTZERKLAERUNG.md). Avoids pulling in a full
 * markdown dependency for two small, controlled documents.
 */
function renderLine(line: string, key: number) {
  if (line.startsWith('## ')) {
    return (
      <Typography key={key} variant="h6" component="h2" sx={{ mt: 3, mb: 1 }}>
        {line.slice(3)}
      </Typography>
    )
  }
  if (line.startsWith('# ')) {
    return (
      <Typography key={key} variant="h4" component="h1" sx={{ mb: 2 }}>
        {line.slice(2)}
      </Typography>
    )
  }
  if (line.trim() === '') {
    return null
  }
  return (
    <Typography key={key} variant="body1" sx={{ mb: 1.5, whiteSpace: 'pre-wrap' }}>
      {line}
    </Typography>
  )
}

export default function LegalDocument({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box>{lines.map((line, i) => renderLine(line, i))}</Box>
    </Container>
  )
}
