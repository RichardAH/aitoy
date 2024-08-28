#/bin/bash
P1='HUMAN: Respond to the following claim with only "true" or "false":

Claim: The text "'"$1"'" is related to chess.

ASSISTANT: '
P2='HUMAN: Respond to the following claim with only "true" or "false":

Claim: The text "'"$1"'" has an offensive word.

ASSISTANT: '
A1=`LD_LIBRARY_PATH=. ./llama-cli -o /tmp/ai -m ./Meta-Llama-3-8B-Instruct.Q3_K_L.gguf --no-display-prompt --temp 0.01 --top_p 0.1 --top_k 2 --n_predict 1 -p "$P1" 2>/dev/null`
A2=`LD_LIBRARY_PATH=. ./llama-cli -o /tmp/ai -m ./Meta-Llama-3-8B-Instruct.Q3_K_L.gguf --no-display-prompt --temp 0.01 --top_p 0.1 --top_k 2 --n_predict 1 -p "$P2" 2>/dev/null`
echo '{"chess":  '` echo "$A1" | tr '[:upper:]' '[:lower:]'`',"rude": '` echo "$A2" | tr '[:upper:]' '[:lower:]'`'}'
> main.log
