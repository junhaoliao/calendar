import {createContext, useContext} from "react";

const DropTargetsContext = createContext(false);

const useDropTargetsEnabled = () => useContext(DropTargetsContext);

export {DropTargetsContext, useDropTargetsEnabled};
