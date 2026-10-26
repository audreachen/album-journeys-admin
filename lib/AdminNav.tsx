import Link from 'next/link';
import { resources } from './catalog';
import { signOut } from '@/app/actions';
export default function AdminNav() {
  return <><div className="brand"><Link href="/">🍓 THE FRUIT STAND</Link><span>ALBUM JOURNEYS / ADMINISTRATION</span></div><nav aria-label="Administration"><Link href="/">Overview</Link><Link href="/log">AI generation log</Link><Link href="/users">Users</Link><Link href="/images">Uploaded images</Link><Link href="/maps">Curated maps</Link><Link href="/ratings">Ratings</Link>{Object.entries(resources).map(([key,r]) => <Link key={key} href={`/catalog/${key}`}>{r.title}</Link>)}<form action={signOut}><button>Sign out</button></form></nav></>;
}
