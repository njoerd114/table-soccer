import content from '../../DATENSCHUTZERKLAERUNG.md?raw'
import LegalDocument from '../components/LegalDocument'

export default function Datenschutz() {
  return <LegalDocument content={content} />
}
