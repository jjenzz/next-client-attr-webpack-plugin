import 'client-only';
import * as React from 'react';
import { Button } from './button';

/* -------------------------------------------------------------------------------------------------
 * Counter
 * -----------------------------------------------------------------------------------------------*/

function Counter() {
  const [count, setCount] = React.useState(0);
  return (
    <div className="text-center flex flex-col gap-4">
      {count}
      <Button onClick={() => setCount((count) => count + 1)}>increment</Button>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

export { Counter };
