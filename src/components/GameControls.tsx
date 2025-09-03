import React from 'react';
import ReplayControls from './ReplayControls';
import { useTranslation } from 'react-i18next';

interface GameControlsProps {
    state: any;
    dispatch: (action: any) => void;
    replayGame: any;
}

export const GameControls = ({
    state,
    dispatch,
    replayGame,
}: GameControlsProps) => {
    const { t } = useTranslation();

    const enterWhatIfMode = () => {
        dispatch({ type: 'ENTER_WHAT_IF', payload: { history: state.history, replayIndex: state.replayMoveIndex } });
    }

    const exitWhatIfMode = () => {
        dispatch({ type: 'EXIT_WHAT_IF' });
    }

    return (
        <div className="mt-4 flex flex-col items-center gap-2">
            {state.gameState === 'replay' && !state.isWhatIfMode && (
                <ReplayControls
                    moveCount={state.history.length}
                    currentMove={state.replayMoveIndex}
                    setCurrentMove={(index) => dispatch({ type: 'SET_REPLAY_INDEX', payload: index })}
                    isPlaying={state.isReplaying}
                    setIsPlaying={(playing) => dispatch({ type: 'SET_IS_REPLAYING', payload: playing })}
                    onWhatIf={replayGame?.game_type === 'pva' ? enterWhatIfMode : undefined}
                />
            )}
            {state.isWhatIfMode && <button onClick={exitWhatIfMode} disabled={state.isAiThinking} className="mt-2 px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-500">{state.isAiThinking ? t('Thinking') : t('ExitWhatIf')}</button>}
        </div>
    );
};