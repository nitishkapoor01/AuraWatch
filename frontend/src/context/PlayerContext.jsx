import React, { createContext, useContext, useState } from 'react';

const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [playerState, setPlayerState] = useState({
    isOpen: false,
    isSticky: false, // true = PiP mode
    movieData: null, // { id, type, title, season, episode, epName }
  });

  const openPlayer = (data) => {
    setPlayerState({
      isOpen: true,
      isSticky: false,
      movieData: data,
    });
  };

  const closePlayer = () => {
    setPlayerState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const setSticky = (sticky) => {
    setPlayerState((prev) => ({
      ...prev,
      isSticky: sticky,
    }));
  };

  return (
    <PlayerContext.Provider value={{ playerState, openPlayer, closePlayer, setSticky }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => useContext(PlayerContext);
