import { redirect } from 'next/navigation';

/** Alias public vers le formulaire de pré-inscription. */
export default function PreInscriptionPage() {
  redirect('/inscription');
}
