const HotPocket = require('hotpocket-nodejs-contract');
const fs = require('fs').promises;
const { execSync } = require('child_process');
const { quote } = require('shell-quote');

function runShellScript(scriptPath, parameter)
{
    try {
        const sanitizedParam = quote([parameter]);
        const command = `${scriptPath} ${sanitizedParam}`;
        console.log('command:', command);
        const stdout = execSync(command, { encoding: 'utf-8', shell: '/bin/bash' });
        console.log('stdout:', stdout);
        return stdout.trim();
    } catch (error) {
        console.error(`Error executing the script: ${error}`);
        return null;
    }
}

const hpc = new HotPocket.Contract();
async function contract(ctx)
{
    await new Promise(async (resolve) =>
    {
        let user_count = 0;
        let users = {};
        let user_query = {};

        const isReadOnly = ctx.readonly;
        let query_count = 0;

        let unread_inputs = 0;
        for (const user of ctx.users.list())
            unread_inputs += user.inputs.length;

        const resolveIfDone = ()=>
        {
            if (query_count <= 0 && unread_inputs <= 0)
            {
                console.log("done, quitting.");
                resolve();
                return;
            }
        };


        if (!isReadOnly)
        {
            ctx.unl.onMessage(async (node, msg) =>
            {

                console.log("npl message: " + node + msg);
                const json = JSON.parse(msg);

                if (typeof(user_query[json.user]) == "undefined")
                    user_query[json.user] = {};

                const position = (json.chess ? 2 : 0) + (json.rude ? 1 : 0);
                if (typeof(user_query[json.user][position]) == "undefined")
                    user_query[json.user][position] = 1;
                else
                    user_query[json.user][position]++;

                let total = 0;
                let best = 0;
                let best_pos = -1;

                // do this in a canonical order so if there's a tie the last tied outcome
                // is the canonical outcome
                for (let pos = 0; pos < 3; ++pos)
                {
                    if (typeof(user_query[json.user][pos]) == "undefined")
                        continue;

                    total += user_query[json.user][pos];
                    if (user_query[json.user][pos] > best)
                    {
                        best = user_query[json.user][pos];
                        best_pos = pos;
                    }
                }

                if (total >= ctx.unl.list().length)
                {

                    let output =
                                {
                                    "answer": true,
                                    "yays": best,
                                    "nays": (total - best),
                                    "chess": (best_pos >> 1) == 1,
                                    "rude": (best_pos & 1) == 1
                                };
                    console.dir(output);
                    // done
                    if (users[json.user])
                        await users[json.user].send(JSON.stringify(output));
                    user_query[json.user] = {};
                    users[json.user] = {};
                    query_count--;
                }

                resolveIfDone();
            });
        }



        for (const user of ctx.users.list())
        {

            users[user_count++] = user;

            for (const input of user.inputs)
            {

                const buf = await ctx.users.read(input);

                unread_inputs--;

                console.log(buf.toString('utf-8'));
                const message = JSON.parse(buf);


                if (message.type == 'stat')
                {

                    await user.send(JSON.stringify({
                        type: 'statResult',
                        data: 'Contract is online'
                    }));

                    return resolveIfDone();
                }

                if (message.type == 'query')
                {

                    if (typeof(message.data) === "undefined")
                    {
                        await user.send(JSON.stringify(
                            {
                                type: 'error',
                                error: 'must provide a data field to query message'
                            }));

                        resolveIfDone();
                        continue;
                    }


                    if (isReadOnly)
                    {
                        await user.send(JSON.stringify(
                            {
                                type: 'error',
                                error: 'query interface must not be read only'
                            }));

                        resolveIfDone();
                        continue;
                    }

                    console.log("executing ./ai.sh " + message.data);

                    // execute ai
                    const rawdata = runShellScript('./ai.sh', message.data);

                    console.log('rawdata: ' + rawdata);

                    const data = JSON.parse(rawdata);

                    // add the user's fd to the json object
                    data.user = user_count-1;

                    console.dir(data);

                    query_count++;

                    // push it through the npl
                    await ctx.unl.send(JSON.stringify(data));

                    resolveIfDone();
                    continue;
                }

                await user.send(JSON.stringify({
                        type: 'error',
                        error: 'Unknown message type'
                }));

                resolveIfDone();
            }
        }

        resolveIfDone();
    });

    console.log("execution to end");
}

hpc.init(contract, undefined,true);
