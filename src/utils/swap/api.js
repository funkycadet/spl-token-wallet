import { useAsyncData } from '../fetch-loop';
import * as anchor from '@project-serum/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@project-serum/token';

const provider = anchor.AnchorProvider.local();
anchor.setProvider(provider);

const idl = require('./openbook_v2_idl.json'); // Load your OpenBook V2 IDL
const programID = new PublicKey('opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb'); // Replace with the actual program ID
const program = new anchor.Program(idl, programID, provider);

export class SwapApiError extends Error {
  constructor(msg, status) {
    super(msg);
    this.name = 'SwapApiError';
    this.status = status;
  }
}

export async function swapApiRequest(
  method,
  path,
  body,
  { ignoreUserErrors = false } = {},
) {
  let headers = {};
  let params = { headers, method };
  if (method === 'GET') {
    params.cache = 'no-cache';
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    params.body = JSON.stringify(body);
  }

  let resp = await fetch(`https://swap.sollet.io/api/${path}`, params);
  return await handleSwapApiResponse(resp, ignoreUserErrors);
}

async function handleSwapApiResponse(resp, ignoreUserErrors) {
  let json = await resp.json();
  if (!json.success) {
    if (ignoreUserErrors && resp.status >= 400 && resp.status < 500) {
      return null;
    }
    throw new SwapApiError(json.error, resp.status);
  }
  return json.result;
}

export function useSwapApiGet(path, options) {
  return useAsyncData(
    async () => {
      if (!path) {
        return null;
      }
      return await swapApiRequest('GET', path, undefined, {
        ignoreUserErrors: true,
      });
    },
    ['swapApiGet', path],
    options,
  );
}

export async function swapOnOpenbookV2(userWallet, market, sourceTokenAccount, destinationTokenAccount, amount) {
  const userPublicKey = new PublicKey(userWallet);

  // Create a transaction
  const tx = new anchor.web3.Transaction();

  // Add the swap instruction to the transaction
  tx.add(
    program.instruction.swap(
      new anchor.BN(amount), // Amount to swap
      {
        accounts: {
          market,
          sourceTokenAccount,
          destinationTokenAccount,
          user: userPublicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )
  );

  // Send the transaction
  const signature = await provider.sendAndConfirm(tx, [provider.wallet.payer]);

  console.log("Transaction signature", signature);
}
