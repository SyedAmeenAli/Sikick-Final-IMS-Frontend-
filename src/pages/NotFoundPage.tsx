import { Link } from 'react-router-dom';
import { Page, Panel } from '@/components/ui/primitives';
import { ArtBox } from '@/components/illustrations';

export default function NotFoundPage() {
  return (
    <Page narrow>
      <Panel><div className="empty"><ArtBox /><h3>That page does not exist</h3><p>The link may be old, or the page moved when the workspace was redesigned.</p><Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link></div></Panel>
    </Page>
  );
}
