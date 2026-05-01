import React from 'react';
import styled from 'styled-components';

const Loader = () => {
    return (
        <StyledWrapper>
            <div className="loader">
                <div className="load-inner load-one" />
                <div className="load-inner load-two" />
                <div className="load-inner load-three" />
                <span className="text">Loading...</span>
            </div>
        </StyledWrapper>
    );
}

const StyledWrapper = styled.div`
  .loader {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100px;
    height: 100px;
    margin: 130px 0;
    perspective: 780px;
  }

  .text {
    font-size: 20px;
    font-weight: 700;
    color: #cecece;
    z-index: 10;
  }

  .load-inner {
    position: absolute;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border-radius: 50%;
  }

  .load-inner.load-one {
    left: 0%;
    top: 0%;
    border-bottom: 3px solid #5c5edc;
    animation: rotate1 1.15s linear infinite;
  }

  .load-inner.load-two {
    right: 0%;
    top: 0%;
    border-right: 3px solid #9147ff;
    animation: rotate2 1.15s 0.1s linear infinite;
  }

  .load-inner.load-three {
    right: 0%;
    bottom: 0%;
    border-top: 3px solid #3b82f6;
    animation: rotate3 1.15s 0.15s linear infinite;
  }

  @keyframes rotate1 {
    0% {
      transform: rotateX(45deg) rotateY(-45deg) rotateZ(0deg);
    }
    100% {
      transform: rotateX(45deg) rotateY(-45deg) rotateZ(360deg);
    }
  }
  @keyframes rotate2 {
    0% {
      transform: rotateX(45deg) rotateY(45deg) rotateZ(0deg);
    }
    100% {
      transform: rotateX(45deg) rotateY(45deg) rotateZ(360deg);
    }
  }
  @keyframes rotate3 {
    0% {
      transform: rotateX(-60deg) rotateY(0deg) rotateZ(0deg);
    }
    100% {
      transform: rotateX(-60deg) rotateY(0deg) rotateZ(360deg);
    }
  }`;

export default Loader;
