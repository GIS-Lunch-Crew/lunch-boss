import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    // invoke() may return the value directly or wrapped as { body, metadata },
    // so unwrap before storing it in state.
    invoke<string>('getText', { example: 'my-invoke-variable' }).then(
      (response) => setData(typeof response === 'string' ? response : response.body)
    );
  }, []);

  return (
    <>
      <Text>Hello world!</Text>
      <Text>{data ? data : 'Loading...'}</Text>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
