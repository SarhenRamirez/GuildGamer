import { Ghost } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, Empty } from '../components/ui';

export function NotFoundPage() {
  return (
    <Card>
      <Empty icon={<Ghost className="size-12" />} title="Esta página no existe">
        <Link to="/">
          <Button className="mt-3">Volver al inicio</Button>
        </Link>
      </Empty>
    </Card>
  );
}
