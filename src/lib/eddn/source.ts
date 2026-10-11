export const EDDN_RELAY = "tcp://eddn.edcd.io:9500";
const SILENCE_MS = 10 * 60_000; // the relay publishes constantly; ten silent minutes means the connection is dead

// The relay's compressed messages as they arrive. ZeroMQ reconnects a dropped connection by itself; a connection that
// goes silent makes this throw, so the caller can start a fresh one. Closes when the signal aborts.
export async function* relayMessages(url = EDDN_RELAY, signal?: AbortSignal): AsyncGenerator<Uint8Array> {
  const { Subscriber } = await import("zeromq"); // loaded here so the rest of the app never needs the native module
  const socket = new Subscriber();
  socket.receiveTimeout = SILENCE_MS;
  socket.connect(url);
  socket.subscribe(); // everything
  const close = () => socket.close();
  signal?.addEventListener("abort", close, { once: true });
  try {
    for await (const [message] of socket) yield message;
  } catch (e) {
    if (!signal?.aborted) throw e; // closing the socket on abort ends the loop with an error: that is the normal way out
  } finally {
    signal?.removeEventListener("abort", close);
    close();
  }
}
