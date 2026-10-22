import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import WorkspaceLayout from './WorkspaceLayout';
import WorkspaceHome from './WorkspaceHome';
import WorkspaceModulePage from './WorkspaceModulePage';
export default function WorkspaceRouter(){return <Routes><Route element={<WorkspaceLayout/>}><Route path="dashboard" element={<WorkspaceHome/>}/><Route path=":moduleKey" element={<WorkspaceModulePage/>}/><Route index element={<Navigate to="dashboard" replace/>}/></Route></Routes>}
