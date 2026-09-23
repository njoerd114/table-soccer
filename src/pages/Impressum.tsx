import content from '../../IMPRESSUM.md?raw'
import LegalDocument from '../components/LegalDocument'

export default function Impressum() {
  return <LegalDocument content={content} />
}
