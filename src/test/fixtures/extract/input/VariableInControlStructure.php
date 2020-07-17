<?php

class EmptyClass
{
    public function testExtractVariable(bool $isTrue, string $whatever)
    {
        if ($isTrue && $whatever === 'WeshGros') {
            return false;
        }

        return true;
    }
}