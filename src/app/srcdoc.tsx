import { Redirect } from 'expo-router';

/** The single-file preview runs as an about:srcdoc document; its first path is "srcdoc". Send it home. */
export default function SrcdocRedirect() {
  return <Redirect href="/" />;
}
