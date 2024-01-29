# MyQ
Implementation of Chamberlain's MyQ API for TypeScript.

This exposes a method to interact with MyQ devices. This requires the client to impliment the system that needs to be intergrated.

## API

Connect to a MyQ cloud account.
```js
import { Connection } from "@mkellsy/myq";

const connection = new Connection();

connection.authenticate(email, password);
```

Making a request
```js
import { Device } from "@mkellsy/myq";

const accounts = connection.accounts;
const devices = await connection.read<Devices>(`/Accounts/${accounts[0]}/Devices`);

for (const device of devices.items) {
    // device logic
}
```

Device list
```
/Accounts/[account_id]/Devices
```

Control a device
```js
await connection.command(device, command);
```
