import { LoadingScreen } from "../screens/LoadingScreen";
import { FinishedScreen } from "../screens/FinishedScreen";
import { SetupScreen } from "./SetupScreen";
import { LobbyScreen } from "./LobbyScreen";
import { EngineerGame } from "./EngineerGame";
import { StudentJoin, StudentWaiting, StudentGame } from "./Student";

// Pantallas de Ludo según el rol (docente / estudiante) y la fase de la partida.
//   ludo: lo que devuelve useLudo()   changeDevice: salir de la partida
//   enMenu(activo, pagina): marco con menú lateral   setAuthScreen("login" | "register")
export function LudoPantallas({ ludo, user, changeDevice, enMenu, setAuthScreen }) {
  const {
    addTime,
    answerSeconds,
    bank,
    connError,
    connectedByTeam,
    counts,
    createGame,
    creating,
    endGame,
    gameCode,
    gameInfo,
    gameName,
    joinCode,
    joinError,
    minutes,
    mode,
    newGame,
    phaseSeconds,
    playerId,
    playerRollDice,
    resetGame,
    resetTimer,
    rollSeconds,
    selected,
    serverState,
    setAnswerSeconds,
    setCounts,
    setGameName,
    setJoinCode,
    setMinutes,
    setRollSeconds,
    setStudentName,
    setStudentTeam,
    setTab,
    setupError,
    skipTurn,
    startGame,
    studentName,
    studentTeam,
    submitAnswer,
    submitJoin,
    tab,
    timerSeconds,
    toggleTimer,
  } = ludo;
  if (mode === "engineer") {
    if (!gameCode) {
      return enMenu(
        "juegos",
        <SetupScreen
          gameName={gameName}
          setGameName={setGameName}
          counts={counts}
          setCounts={setCounts}
          minutes={minutes}
          setMinutes={setMinutes}
          answerSeconds={answerSeconds}
          setAnswerSeconds={setAnswerSeconds}
          rollSeconds={rollSeconds}
          setRollSeconds={setRollSeconds}
          createGame={createGame}
          setupError={setupError}
          creating={creating}
          goHome={changeDevice}
        />,
      );
    }
    if (!serverState) return <LoadingScreen code={gameCode} error={connError} onReset={changeDevice} />;

    if (serverState.phase === "lobby") {
      return (
        <>
          <LobbyScreen
            gameName={serverState.name}
            gameCode={gameCode}
            teams={serverState.teams}
            activeTeams={serverState.activeTeams}
            connectedByTeam={connectedByTeam}
            players={serverState.players}
            startGame={startGame}
            newGame={newGame}
            changeDevice={changeDevice}
          />
        </>
      );
    }

    if (serverState.phase === "finished") {
      return (
        <FinishedScreen
          teams={serverState.teams}
          gameName={serverState.name}
          winner={serverState.winner}
          activeTeams={serverState.activeTeams}
          isEngineer
          resetGame={resetGame}
          newGame={newGame}
          changeDevice={changeDevice}
        />
      );
    }

    return (
      <>
        <EngineerGame
          tab={tab}
          setTab={setTab}
          serverState={serverState}
          timerSeconds={timerSeconds}
          phaseSeconds={phaseSeconds}
          toggleTimer={toggleTimer}
          addTime={addTime}
          resetTimer={resetTimer}
          skipTurn={skipTurn}
          endGame={endGame}
          resetGame={resetGame}
          newGame={newGame}
          positions={serverState.positions}
          bank={bank}
        />
      </>
    );
  }

  // mode === "student"
  if (!playerId) {
    return (
      <StudentJoin
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        studentName={studentName}
        setStudentName={setStudentName}
        studentTeam={studentTeam}
        setStudentTeam={setStudentTeam}
        submitJoin={submitJoin}
        joinError={joinError}
        gameInfo={gameInfo}
        goHome={changeDevice}
        onLogin={() => {
          changeDevice();
          setAuthScreen("login");
        }}
        onRegister={() => {
          changeDevice();
          setAuthScreen("register");
        }}
        isLogged={!!user}
      />
    );
  }
  if (!serverState) return <LoadingScreen code={gameCode} error={connError} onReset={changeDevice} />;

  if (serverState.phase === "lobby") {
    return (
      <StudentWaiting
        gameCode={gameCode}
        studentName={studentName}
        studentTeam={studentTeam}
        changeDevice={changeDevice}
      />
    );
  }

  if (serverState.phase === "finished") {
    return (
      <FinishedScreen
        teams={serverState.teams}
        gameName={serverState.name}
        winner={serverState.winner}
        activeTeams={serverState.activeTeams}
        myTeam={studentTeam}
        changeDevice={changeDevice}
      />
    );
  }

  return (
    <StudentGame
      serverState={serverState}
      playerId={playerId}
      selected={selected}
      phaseSeconds={phaseSeconds}
      positions={serverState.positions}
      submitAnswer={submitAnswer}
      rollDice={playerRollDice}
      changeDevice={changeDevice}
    />
  );
}
